/**
 * CLI helper to reset the destination settings of source chain pool
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import { getResetDestinationChainPoolName } from "./lib/CCIPIgnitionDeployments.ts";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";

interface ResetDestinationChainArguments {
  source: string;
  destination: string;
  stkp?: string;
  dtkp?: string;
  bsha?: string;
}

export default async function (
  _taskArguments: ResetDestinationChainArguments,
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

  if (!_taskArguments.bsha) {
    return printAndReturnErrorResult(
      `BridgedSharesUnderAgreement token deployed on source chain: ${sourceNetworkName} must be provided using flag "--bsha"`
    );
  }
  let bsha = _taskArguments.bsha;

  // TODO existence and correctness check

  // Compute LSB addresses
  const lsbBytesBridgedSharesUnderAgreement =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [bsha]
    );
  console.log(
    `lsbBytesBridgedSharesUnderAgreement: ${lsbBytesBridgedSharesUnderAgreement}`
  );

  const lsbBytesDestinationTokenPool =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [destinationTokenPoolAddress]
    );
  console.log(`lsbBytesDestinationTokenPool: ${lsbBytesDestinationTokenPool}`);
  // //

  // Make source chain aware of new destination
  console.log(
    `\n\nExecuting ResetDestinationChainModule for source network ${sourceNetworkName} and destination network ${destinationNetworkName}`
  );
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/ResetDestinationChainModule.ts")
    ).default,
    {
      deploymentId: getResetDestinationChainPoolName(sourceNetworkName),

      parameters: {
        ResetDestinationChainModule: {
          localTokenPool: sourceTokenPoolAddress,

          remoteChainSelector:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
              .remoteChainSelector,
          remotePoolAddress: lsbBytesDestinationTokenPool,
          remoteTokenAddress: lsbBytesBridgedSharesUnderAgreement,
        },
      },

      displayUi: true,
    }
  );

  return successfulResult([]);
}
