/**
 * CLI helper to Mint Shares and Wrap to SharesUnderAgreement on a network
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import type { Address, Shares } from "../../types/ethers-contracts/index.ts";

import readCCIPIgnitionAddresses from "../ccip/lib/CCIPIgnitionDeployments.ts";

import { printAndReturnErrorResult } from "../utils/error.ts";

export interface MintSharesTaskArguments {
  shares?: string;
  sha?: string;
  amount: string;
  to?: string;
  ccipIgnition: boolean;
}

export default async function (
  _taskArguments: MintSharesTaskArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  let sharesAddress = _taskArguments.shares;
  let shaAddress = _taskArguments.sha;

  // connection does have ethers
  // should fix ts somehow
  const connection = await _hre.network.create();
  const { ethers } = connection;

  // maybe ccip-ignition
  if (_taskArguments.ccipIgnition) {
    // read
    const bundle = readCCIPIgnitionAddresses(connection.networkName);
    if (!bundle) {
      return printAndReturnErrorResult(
        "Network has not been used as source chain, do not use `--ccip-ignition` or change network with `--network`"
      );
    }

    const bundles = bundle.source;
    if (!bundles.sharesAddress) {
      return printAndReturnErrorResult(
        "Deployment did not deply Shares contract on Source chain"
      );
    }
    if (!bundles.sha) {
      return printAndReturnErrorResult(
        "Deployment did not deply SharesUnderAgreement contract on Source chain"
      );
    }

    sharesAddress = bundles.sharesAddress!;
    shaAddress = bundles.sha!;
  }

  if (!sharesAddress) {
    // maybe better address checks
    return printAndReturnErrorResult(
      "No share token address specified through --shares [address]"
    );
  }
  if (!shaAddress) {
    // maybe better address checks
    return printAndReturnErrorResult(
      "No sha address specified through --sha [address]"
    );
  }

  // from accounts: [...] we get first signer
  const [signer] = await connection.ethers.getSigners();
  const amount = _taskArguments.amount;
  let to = _taskArguments.to;
  if (!to) {
    // maybe better address checks
    to = await signer.getAddress();
  }

  console.log(`Network: ${connection.networkName}`);
  console.log(`Signer: ${await signer.getAddress()}`);
  console.log(`Reciever: ${to}`);
  console.log(`Shares: ${sharesAddress}`);
  console.log(`SHA: ${shaAddress}`);

  const shares: Shares = await ethers.getContractAt(
    "Shares",
    sharesAddress,
    signer
  );

  // even if it could be hardcoded as 0..
  // const decimals = await shares.decimals();
  const amountToMint: bigint = ethers.parseUnits(amount, 0);
  const tx = await shares.mintAndWrap(
    to as any as Address,
    shaAddress as any as Address,
    amountToMint
  );

  console.log(`Transaction hash: ${tx.hash}`);

  await tx.wait();

  const mintMessage: string = `Minted ${amount} tokens to ${to}`;
  console.log(mintMessage);
  return successfulResult([mintMessage]);
}
