/**
 * CLI helper to deploy additional destination chain with an already deployed TokenPool
 * on a source chain
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";
import {
  getBridgedSharesDeploymentName,
  getBridgedSharesSetpoolDeploymentName,
  getFactoryDeploymentName,
  getSettingsDeploymentName,
  getUpdateSourceChainName,
} from "./lib/CCIPIgnitionDeployments.ts";
import { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";
import { prettyStringifyObject } from "../utils/json.ts";
import { CREATE2_SALT } from "../../ignition/modules/ccip/lib/config.ts";
import { PoolType } from "../../ignition/modules/ccip/lib/types.ts";
import { predictTokenPoolAddress } from "../../ignition/modules/ccip/lib/tokenPool.ts";

interface AddDestinationChainArguments {
  source: string;
  destination: string;
  stkp?: string;
  sha?: string;
  terms: string;
  name: string;
  symbol: string;
}

export default async function (
  _taskArguments: AddDestinationChainArguments,
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

  // other passed in parameters, decimals are equal on bith side
  // can be dynamically fetched later if needed
  const decimals = 0;

  console.log(`\n\nConnecting to networks...`);
  console.log(`To ${sourceNetworkName}...`);
  const sourceConnection = await _hre.network.create({
    network: sourceNetworkName,
  });

  console.log(`To ${destinationNetworkName}...`);
  const destinationConnection = await _hre.network.create({
    network: destinationNetworkName,
  });
  console.log(`All networks connected`);

  if (!_taskArguments.stkp) {
    return printAndReturnErrorResult(
      `The source Token Pool address deployed on: ${sourceNetworkName} must be provided using flag "--stkp"`
    );
  }
  let sourceTokenPoolAddress = _taskArguments.stkp;

  // TODO existence and correctness check

  if (!_taskArguments.sha) {
    return printAndReturnErrorResult(
      `SharesUnderAgreement token deployed on source chain: ${sourceNetworkName} must be provided using flag "--sha"`
    );
  }
  let sha = _taskArguments.sha;

  // TODO existence and correctness check

  // Deploy bSHA to destination
  console.log(
    `\n\nDeploying BridgedSharesUnderAgreement on ${destinationNetworkName}...`
  );
  const { BridgedSharesUnderAgreement } =
    await destinationConnection.ignition.deploy(
      (
        await import("../../ignition/modules/shares/BridgedSHAModule.ts")
      ).default,
      {
        deploymentId: getBridgedSharesDeploymentName(destinationNetworkName),

        parameters: {
          BridgedSHAModule: {
            SYMBOL: _taskArguments.symbol,
            NAME: _taskArguments.name,
            TERMS: _taskArguments.terms,
          },
        },

        displayUi: true,
      }
    );
  console.log(
    `BridgedSharesUnderAgreement deployed on ${destinationNetworkName}`
  );

  // // Some Precomputation: could be abstracted aslo for deploy
  // load Artifacts
  console.log(`\n\nLoading BurnMintTokenPool artifacts...`);
  const sourcePoolType = PoolType.LOCK_RELEASE;
  const burnMintTokenPoolArtifact = await _hre.artifacts.readArtifact(
    "BurnMintTokenPool"
  );
  const destinationPoolType = PoolType.BURN_MINT;
  console.log(`Artifacts loaded`);

  // We predeterministically predict only
  // BurnMintTokenPool
  console.log(`\n\nPredicting LockReleaseTokenPool Address...`);
  const [signer] = await sourceConnection.ethers.getSigners();
  console.log(`Predicting BurnMintTokenPool Address...`);
  // TODO multiple predictions deployments if multiple chain are requested to be implemented
  const destinationTokenPoolFactory =
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
      .tokenPoolFactory;
  const predictedBurnMintTokenPoolAddress = predictTokenPoolAddress(
    destinationTokenPoolFactory,
    CREATE2_SALT,
    await signer.getAddress(),
    await BridgedSharesUnderAgreement.getAddress(),
    decimals,
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].rmnProxy,
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].router,
    burnMintTokenPoolArtifact.bytecode,
    PoolType.BURN_MINT
  );
  console.log(
    `Predicted BurnMintTokenPool Address: ${predictedBurnMintTokenPoolAddress}`
  );

  // Compute LSB addresses
  console.log(`Computing LSB encoded addresses...`);
  const lsbBytesSharesUnderAgreement =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [sha]
    );
  console.log(`lsbBytesSharesUnderAgreement: ${lsbBytesSharesUnderAgreement}`);

  const bridgedSharesUnderAgreement: string =
    await BridgedSharesUnderAgreement.getAddress();
  const lsbBytesBridgedSharesUnderAgreement =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [bridgedSharesUnderAgreement]
    );
  console.log(
    `lsbBytesBridgedSharesUnderAgreement: ${lsbBytesBridgedSharesUnderAgreement}`
  );

  const lsbBytesPredictedBurnMintTokenPoolAddress =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [predictedBurnMintTokenPoolAddress]
    );
  console.log(
    `lsbBytesPredictedBurnMintTokenPoolAddress: ${lsbBytesPredictedBurnMintTokenPoolAddress}`
  );

  const lsbBytesLockReleaseTokenPoolAddress =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [sourceTokenPoolAddress]
    );
  console.log(
    `lsbBytesLockReleaseTokenPoolAddress: ${lsbBytesLockReleaseTokenPoolAddress}`
  );
  // //

  // Deploy CCIP Contracts to destination
  // BurnMintTokenPool via TokenPoolFactory
  console.log(
    `\n\nExecuting TokenPoolFactoryModule for network ${destinationNetworkName}`
  );
  const DESTINATION_FACTORY_PARAMETERS = {
    // salt
    salt: CREATE2_SALT,

    // tokens
    localToken: await BridgedSharesUnderAgreement.getAddress(),
    localDecimals: decimals,
    remoteToken: lsbBytesSharesUnderAgreement,
    remoteDecimals: decimals,

    // pools
    localPoolType: destinationPoolType,
    remoteTokenPool: lsbBytesLockReleaseTokenPoolAddress,
    remotePoolType: sourcePoolType,

    // Chainlink source addresses
    localTokenPoolFactory: destinationTokenPoolFactory,

    // Chainlink destination addresses
    remoteChainSelector:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .remoteChainSelector,
    remotePoolFactory:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].tokenPoolFactory,
    remoteRouter:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
    remoteRMNProxy:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].rmnProxy,

    // bytecodes
    localTokenPoolBytecode: burnMintTokenPoolArtifact.bytecode,
  };
  console.log(
    `Parameters:\n${prettyStringifyObject(DESTINATION_FACTORY_PARAMETERS)}\n`
  );
  await destinationConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/TokenPoolFactoryModule.ts")
    ).default,
    {
      deploymentId: getFactoryDeploymentName(destinationNetworkName),

      parameters: {
        TokenPoolFactoryModule: DESTINATION_FACTORY_PARAMETERS,
      },

      displayUi: true,
    }
  );

  // Apply Settings to destination
  // CCIP Settings transactions
  // for destination network
  console.log(
    `\n\nExecuting ChainSettingsModule for network ${destinationNetworkName}`
  );
  const DESTINATION_CHAIN_SETTINGS_PARAMETERS = {
    // bsha
    localToken: await BridgedSharesUnderAgreement.getAddress(),
    // burn mint pool address
    localTokenPool: predictedBurnMintTokenPoolAddress,

    localRegistryModuleOwner:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
        .registryModuleOwner,
    localTokenAdminRegistry:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
        .tokenAdminRegistry,
  };
  console.log(
    `Parameters:\n${prettyStringifyObject(
      DESTINATION_CHAIN_SETTINGS_PARAMETERS
    )}\n`
  );
  await destinationConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/ChainSettingsModule.ts")
    ).default,
    {
      deploymentId: getSettingsDeploymentName(destinationNetworkName),

      parameters: {
        ChainSettingsModule: DESTINATION_CHAIN_SETTINGS_PARAMETERS,
      },

      displayUi: true,
    }
  );

  // Apply pool ownership to destination
  console.log(
    `\n\nExecuting DestinationSetPoolBSHAModule for network ${destinationNetworkName}`
  );
  await destinationConnection.ignition.deploy(
    (
      await import(
        "../../ignition/modules/ccip/DestinationSetPoolBSHAModule.ts"
      )
    ).default,
    {
      deploymentId: getBridgedSharesSetpoolDeploymentName(
        destinationNetworkName
      ),

      parameters: {
        DestinationSetPoolBSHAModule: {
          localToken: await BridgedSharesUnderAgreement.getAddress(),
          localTokenPool: predictedBurnMintTokenPoolAddress,
        },
      },

      displayUi: true,
    }
  );

  // Make source chain aware of new destination
  console.log(
    `\n\nExecuting AddDestinationChainModule for network ${sourceNetworkName}`
  );
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/AddDestinationChainModule.ts")
    ).default,
    {
      deploymentId: getUpdateSourceChainName(sourceNetworkName),

      parameters: {
        AddDestinationChainModule: {
          localTokenPool: sourceTokenPoolAddress,

          remoteChainSelector:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
              .remoteChainSelector,
          remotePoolAddress: lsbBytesPredictedBurnMintTokenPoolAddress,
          remoteTokenAddress: lsbBytesBridgedSharesUnderAgreement,
        },
      },

      displayUi: true,
    }
  );

  return successfulResult([]);
}
