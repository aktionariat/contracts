/**
 * CLI helper to halt destination chains bridging
 */

import fs from "node:fs";
import path from "node:path";

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";

const BASE_PATH = "./ignition/deployments";

interface ManageBirdgeArguments {
  source: string;
  destination: string;
  stkp?: string;
  halt: boolean;
  reset: boolean;
}

export default async function (
  _taskArguments: ManageBirdgeArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  // Read arguments
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

  if (!_taskArguments.stkp) {
    return printAndReturnErrorResult(
      `The source Token Pool address deployed on: ${sourceNetworkName} must be provided using flag "--stkp"`
    );
  }
  const sourceTokenPoolAddress = _taskArguments.stkp;

  // Connection
  console.log(`\n\nConnecting to networks...`);
  console.log(`\tTo ${sourceNetworkName}...`);
  const sourceConnection = await _hre.network.create({
    network: sourceNetworkName,
  });
  console.log(`All networks connected`);

  const remoteChainSelectors: bigint[] = [];
  for (let i = 0; i < destinationNetworks.length; i++) {
    remoteChainSelectors.push(
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworks[i]]
        .remoteChainSelector
    );
  }

  if (_taskArguments.reset) {
    // delete ignition folder
    const prefix = `${
      _taskArguments.halt ? "halt" : "activate"
    }-bridge-to-destination-`;

    for (const entry of fs.readdirSync(BASE_PATH, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(prefix)) {
        fs.rmSync(path.join(BASE_PATH, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }
  }

  await sourceConnection.ignition.deploy(
    (_taskArguments.halt
      ? await import("../../ignition/modules/ccip/HaltBridgeModule.ts")
      : await import("../../ignition/modules/ccip/ActivateBridgeModule.ts")
    ).default,
    {
      deploymentId:
        (_taskArguments.halt ? `halt` : `activate`) +
        `-bridge-to-destination-${_taskArguments.destination}`,

      parameters: _taskArguments.halt
        ? {
            HaltBridgeModule: {
              localTokenPool: sourceTokenPoolAddress,
              remoteChainSelectors,
            },
          }
        : {
            ActivateBridgeModule: {
              localTokenPool: sourceTokenPoolAddress,
              remoteChainSelectors,
            },
          },

      displayUi: true,
    }
  );
  return successfulResult([]);
}
