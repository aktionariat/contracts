/**
 * CLI helper to activate destination chains bridging
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";
import {
  addTimeToName,
  getSetRateLimiterName,
} from "./lib/CCIPIgnitionDeployments.ts";

import { RateLimiterConfigSolidityParameter } from "../../ignition/modules/ccip/lib/types.ts";

interface SetRateLimiterArguments {
  source: string;
  destination: string;
  stkp?: string;
}

export default async function (
  _taskArguments: SetRateLimiterArguments,
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

  // within call, check if rate limit admin is empty, if so set it?
  //		-> Not necessary, if owner is calling

  // probably read from some configs file in prod
  // build inputs
  const destinationNetworksRemoteChainSelectors = destinationNetworks.map(
    (v) => CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[v].remoteChainSelector
  );

  // build outbond blocking rates
  const outboundConfig: RateLimiterConfigSolidityParameter[] = [];
  const inboundConfig: RateLimiterConfigSolidityParameter[] = [];
  for (let i = 0; i < destinationNetworksRemoteChainSelectors.length; i++) {
    outboundConfig.push({
      isEnabled: false,
      capacity: 0n,
      rate: 0n,
    });
    // has to be same
    inboundConfig.push({
      isEnabled: false,
      capacity: 0n,
      rate: 0n,
    });
  }

  // make call to set outbound rate limit to 0, keep inbound rate limit deactivated
  // do so sending a batch of remoteChainSelectors, halt any destination
  // has to set a capacity of 0 and a rate of 1
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/SetRateLimiterModule.ts")
    ).default,
    {
      deploymentId: addTimeToName(getSetRateLimiterName(sourceNetworkName)),

      parameters: {
        SetRateLimiterModule: {
          localTokenPool: sourceTokenPoolAddress,
          remoteChainSelectors: destinationNetworksRemoteChainSelectors,
          outboundConfig: outboundConfig,
          inboundConfigs: inboundConfig,
        },
      },

      displayUi: true,
    }
  );

  return successfulResult([]);
}
