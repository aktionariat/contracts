/**
 * CLI helper to allow TokenPoolAddress in a BridgedSharesUnderAgreement token
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";

import { printAndReturnErrorResult } from "../utils/error.ts";
import readCCIPIgnitionAddresses from "./lib/CCIPIgnitionDeployments.ts";

interface EstimateCCIPDeploymentGasTaskArguments {
  tkp?: string;
  bsha?: string;
  ccipIgnition: boolean;
}

export default async function (
  _taskArguments: EstimateCCIPDeploymentGasTaskArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  const connection = await _hre.network.create();

  let tokenPoolAddress = _taskArguments.tkp;
  let bSHA = _taskArguments.bsha;

  if (_taskArguments.ccipIgnition) {
    const addresses = readCCIPIgnitionAddresses(connection.networkName);

    if (
      !addresses ||
      !addresses.destination.bridgedSha // ||
      // !addresses.destination.burnMintTokenPool
    ) {
      return printAndReturnErrorResult(
        "No valid CCIP Ignition deployment or no BSHA address present"
      );
    }

    bSHA = addresses.destination.bridgedSha;
    // tokenPoolAddress = addresses.destination.burnMintTokenPool;
  }

  if (!tokenPoolAddress) {
    return printAndReturnErrorResult(
      "TokenPoolAddress not provided and provided network does not have Chainlink CCIP addresses table"
    );
  }
  console.log("TokenPoolAddress: ", tokenPoolAddress);

  if (!bSHA) {
    return printAndReturnErrorResult(
      "BridgedSharesUnderAgreement not provided"
    );
  }
  console.log("BridgedSharesUnderAgreement: ", bSHA);

  // make call
  const BSHA = await connection.ethers.getContractAt(
    "BridgedSharesUnderAgreement",
    bSHA
  );

  // set
  console.log(
    "Setting TokenPoolAddress as pool within BridgedSharesUnderAgreement..."
  );
  const tx = await BSHA.setPool(tokenPoolAddress);
  console.log(`Transaction hash: ${tx.hash}`);

  await tx.wait();

  console.log(`Set ${tokenPoolAddress} as pool for BSHA ${bSHA}`);
  return successfulResult([]);
}
