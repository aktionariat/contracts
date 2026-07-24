/**
 * Bridging utility to send tokens from one network to the other
 *
 * Routing API does not change based on pool behaviour, message always stays
 * the same. If you bridge from source to destination you can do it backwards
 * by simplt switching CLI parameters.
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import { AbiCoder, ethers } from "ethers";

import { CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE } from "./const/CCIPAddresses.ts";

import readCCIPIgnitionAddresses from "./lib/CCIPIgnitionDeployments.ts";

import { printAndReturnErrorResult } from "../utils/error.ts";

import type { EVM2AnyMessage } from "./types/Messages.ts";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";

export interface BridgeTokenTasks {
  sha?: string;
  amount: string;
  source?: string;
  destination: string;
  to?: string;
  ccipIgnition: boolean;
}

export default async function (
  _taskArguments: BridgeTokenTasks,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  const connection = await _hre.network.create();

  let sha = _taskArguments.sha;
  let source = _taskArguments.source;
  let amount = _taskArguments.amount;
  const decimals = 0; //hardcoded, but could be made into decimals call
  let destination = _taskArguments.destination;

  if (_taskArguments.ccipIgnition) {
    // load from ignition module
    const addresses = readCCIPIgnitionAddresses(connection.networkName);

    if (!addresses || !addresses.source.sha) {
      return printAndReturnErrorResult(
        "No valid CCIP Ignition deployment or no BSHA address present"
      );
    }

    sha = addresses.source.sha;
    source = connection.networkName;
  }

  if (!sha) {
    return printAndReturnErrorResult(
      "Provide SharesUnderAgreement address or use `--ccipIgnition`"
    );
  }

  if (!source || !(source in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE)) {
    return printAndReturnErrorResult(
      "Soruce Network does not have an entry in CCIP Addresses table, change network with `--network`"
    );
  }
  if (!(destination in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE)) {
    return printAndReturnErrorResult(
      "Destination Network does not have an entry in CCIP Addresses table.\nNote, if you are using flag `--ccipIgnition` you still have to provide a valid Network destination chain"
    );
  }

  // get sender by first account
  const [sender] = await connection.ethers.getSigners();

  // Router address
  const router =
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[source as CCIPNetwork].router;

  // Compute receiver
  let receiverAddress = _taskArguments.to;
  if (!receiverAddress) {
    receiverAddress = await sender.getAddress();
  }

  // direct call: we skip CCIPSender entirely

  // approval
  const SHA = await connection.ethers.getContractAt(
    "SharesUnderAgreement",
    sha
  );
  const approvalTxn = await SHA.approve(router, amount);
  console.log(
    `Approving ${router} to spend ${amount} tokens, transaction hash: ${approvalTxn.hash}`
  );
  await approvalTxn.wait();
  console.log(`Approved ${router} to spend ${amount} tokens`);

  // get Router
  // make call
  const RouterClient = await connection.ethers.getContractAt(
    "IRouterClient",
    router
  );

  // Bridge through function:
  //   function ccipSend(
  //     uint64 destinationChainSelector,
  //     Client.EVM2AnyMessage memory message
  //   )
  // message
  const message: EVM2AnyMessage = {
    receiver: AbiCoder.defaultAbiCoder().encode(["address"], [receiverAddress]),
    data: "0x", // no datas
    tokenAmounts: [
      {
        token: sha!,
        amount: ethers.parseUnits(amount, decimals),
      },
    ],
    feeToken: ethers.ZeroAddress, // pay native
    extraArgs: "0x", // no extra arguments
  };

  const feeTxn = await RouterClient.getFee(
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destination as CCIPNetwork]
      .remoteChainSelector,
    message
  );

  console.log(`Spending ${feeTxn} in fees for transaction`);

  const txn = await RouterClient.ccipSend(
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destination as CCIPNetwork]
      .remoteChainSelector,
    message,
    {
      // should fetch native decimals, always 18?
      value: feeTxn.toString(),
    }
  );

  console.log(`Transaction hash: ${txn.hash}`);
  await txn.wait();
  console.log(
    `
${amount} tokens (${sha}) have been bridged from ${source} to ${destination}, with receiver ${receiverAddress}.
As soon as the CCIP network approves it you will receive tokens.
`
  );

  return successfulResult([]);
}
