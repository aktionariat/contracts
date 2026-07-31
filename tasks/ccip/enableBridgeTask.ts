/**
 * CLI helper to halt destination chains bridging
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";
import { getRemoveDestinationChainPoolName } from "./lib/CCIPIgnitionDeployments.ts";

interface HaltBirdgeArguments {
  source: string;
  stkp?: string;
  destination?: string;
  dtkp?: string;
}

export default async function (
  _taskArguments: HaltBirdgeArguments,
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

  // here destination can be an array
  if (!_taskArguments.destination) {
    return printAndReturnErrorResult(
      `At least one destinatiom through "--destination" must be provided`
    );
  }
  if (
    _taskArguments.destination
      .split("-")
      .reduce(
        (prev, v) => prev || !(v in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE),
        false
      )
  ) {
    return printAndReturnErrorResult(
      `One of networks "${_taskArguments.destination}" does not have CCIP infrastructure addresses`
    );
  }
  const destinationNetworks: CCIPNetwork[] = _taskArguments.destination.split(
    "-"
  ) as CCIPNetwork[];

  // same for dtkp
  if (!_taskArguments.dtkp) {
    return printAndReturnErrorResult(
      `At least one destination token pool address through "--dtkp" must be provided, your destination and dtkp length mismatch`
    );
  }
  if (
    _taskArguments.dtkp
      .split("-")
      .reduce(
        (prev, v) => prev || !(v in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE),
        false
      )
  ) {
    return printAndReturnErrorResult(
      `One of networks "${_taskArguments.destination}" does not have CCIP infrastructure addresses`
    );
  }
  const destinationNetworkTokenPools: string[] =
    _taskArguments.destination.split("-");

  // lengths must match
  if (destinationNetworks.length != destinationNetworkTokenPools.length) {
    return printAndReturnErrorResult(`dtkp and destination lengths must match`);
  }

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

  for (let i = 0; i < destinationNetworks.length; i++) {
    // get related destinationTokenPoolAddress
    const destinationNetworkName = destinationNetworks[i];
    const destinationTokenPoolAddress = destinationNetworkTokenPools[i];

    // compute
    const lsbBytesDestinationTokenPoolAddress =
      sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [destinationTokenPoolAddress]
      );

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
              CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[
                destinationNetworkName as CCIPNetwork
              ].remoteChainSelector,
            remotePoolAddress: lsbBytesDestinationTokenPoolAddress,
          },
        },

        displayUi: true,
      }
    );
    console.log(`Pool ${destinationTokenPoolAddress} has been removed`);
  }

  return successfulResult([]);
}
