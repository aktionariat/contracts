/**
 * CLI helper to remove a destination pool from a source pool
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import { getRemoveDestinationChainPoolName } from "./lib/CCIPIgnitionDeployments.ts";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";

interface RemoveDestinationChainPoolArguments {
  source: string;
  destination: string;
  stkp?: string;
  dtkp?: string;
}

export default async function (
  _taskArguments: RemoveDestinationChainPoolArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  // check network name for source and destination
  if (!(_taskArguments.source in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE)) {
    return printAndReturnErrorResult(
      `The network "${_taskArguments.source}" does not have CCIP infrastructure addresses`
    );
  }
  // cast
  const sourceNetworkName: CCIPNetwork = _taskArguments.source as CCIPNetwork;

  if (!(_taskArguments.destination in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE)) {
    return printAndReturnErrorResult(
      `The network "${_taskArguments.destination}" does not have CCIP infrastructure addresses`
    );
  }
  const destinationNetworkName: CCIPNetwork =
    _taskArguments.destination as CCIPNetwork;

  console.log(`\n\nConnecting to networks...`);
  console.log(`To ${sourceNetworkName}...`);
  const sourceConnection = await _hre.network.create({
    network: sourceNetworkName,
  });

  console.log(`All networks connected`);

  if (!_taskArguments.stkp) {
    return printAndReturnErrorResult(
      `The source Token Pool address deployed on: ${sourceNetworkName} must be provided using flag "--stkp"`
    );
  }
  let sourceTokenPoolAddress = _taskArguments.stkp;

  // TODO existence and correctness check

  if (!_taskArguments.dtkp) {
    return printAndReturnErrorResult(
      `The destination Token Pool address deployed on: ${destinationNetworkName} must be provided using flag "--dtkp"`
    );
  }
  let destinationTokenPoolAddress = _taskArguments.dtkp;

  // TODO existence and correctness check

  // compute lsb destinationTokenPoolAddress
  const lsbBytesDestinationTokenPoolAddress =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [destinationTokenPoolAddress]
    );

  // Deploy bSHA to destination
  console.log(
    `\n\nRemoving destination chain pool on ${destinationNetworkName} for pool ${destinationTokenPoolAddress}...`
  );
  await sourceConnection.ignition.deploy(
    (
      await import(
        "../../ignition/modules/ccip/RemoveDestinationChainPoolModule.ts"
      )
    ).default,
    {
      deploymentId: getRemoveDestinationChainPoolName(destinationNetworkName),

      parameters: {
        RemoveDestinationChainPoolModule: {
          localTokenPool: sourceTokenPoolAddress,
          remoteChainSelector:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
              .remoteChainSelector,
          remotePoolAddress: lsbBytesDestinationTokenPoolAddress,
        },
      },

      displayUi: true,
    }
  );
  console.log(`Pool ${destinationTokenPoolAddress} has been removed`);

  return successfulResult([]);
}
