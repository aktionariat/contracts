import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";

import { AbiCoder, concat } from "ethers";

import { printAndReturnErrorResult } from "../utils/error.ts";

import {
  getBridgedSharesDeploymentName,
  getDeploymentName,
  getFactoryDeploymentName,
  getSettingsDeploymentName,
  getSharesDeploymentName,
  resetAllCCIPIgnitionDeploymentFolder,
  resetCCIPIgnitionDeploymentFolder,
} from "./lib/CCIPIgnitionDeployments.ts";

import { predictTokenPoolAddress } from "../../ignition/modules/ccip/lib/tokenPool.ts";

import type { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import { CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE } from "./const/CCIPAddresses.ts";
import { CREATE2_SALT } from "../../ignition/modules/ccip/lib/config.ts";
import {
  BridgedSharesUnderAgreement,
  Shares,
  SharesUnderAgreement,
} from "../../types/ethers-contracts/index.ts";
import { PoolType } from "../../ignition/modules/ccip/lib/types.ts";

export interface DeployCCIP_taskArguments {
  sha?: string;
  terms: string;
  name: string;
  symbol: string;
  source: string;
  destination: string;
  reset?: boolean;
}

export default async function (
  _taskArguments: DeployCCIP_taskArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  // check network name for source and destination
  if (!(_taskArguments.source in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE)) {
    return printAndReturnErrorResult(
      `The network "${_taskArguments.source}" does not have CCIP infrastructure addresses`
    );
  }
  // cast
  const networkNameSource: CCIPNetwork = _taskArguments.source as CCIPNetwork;

  if (!(_taskArguments.destination in CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE)) {
    return printAndReturnErrorResult(
      `The network "${_taskArguments.destination}" does not have CCIP infrastructure addresses`
    );
  }
  const networkNameDestination: CCIPNetwork =
    _taskArguments.destination as CCIPNetwork;

  // other passed in parameters
  const decimals = 0;

  if (_taskArguments.reset) {
    console.log(
      `Resetting ignition deployments for source ${networkNameSource} and destination ${networkNameDestination} network`
    );
    resetAllCCIPIgnitionDeploymentFolder(networkNameSource);
    resetAllCCIPIgnitionDeploymentFolder(networkNameDestination);
  }

  console.log(`\nConnecting to networks...`);
  console.log(`To ${networkNameSource}...`);
  const sourceConnection = await _hre.network.create({
    network: networkNameSource,
  });

  console.log(`To ${networkNameDestination}...`);
  const destinationConnection = await _hre.network.create({
    network: networkNameDestination,
  });
  console.log(`All networks connected`);

  // deploy SHA
  let Shares: Shares;
  let SharesUnderAgreement: SharesUnderAgreement;
  if (!_taskArguments.sha) {
    // sha not passed in we deploy it
    console.log(
      `\nDeploying Shares and SharesUnderAgreement on ${networkNameSource}...`
    );
    const sharesDeplyment = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/shares/SHAModule.ts")
      ).default,
      {
        deploymentId: getSharesDeploymentName(networkNameSource),

        parameters: {
          SHAModule: {
            SYMBOL: _taskArguments.symbol,
            NAME: _taskArguments.name,
            TERMS: _taskArguments.terms,
          },
        },

        displayUi: true,
      }
    );

    Shares = sharesDeplyment.Shares as any as Shares;
    SharesUnderAgreement =
      sharesDeplyment.SharesUnderAgreement as any as SharesUnderAgreement;
    console.log(
      `Shares and SharesUnderAgreement deployed on ${networkNameSource}\n\tShares: ${await Shares.getAddress()}\n\tSharesUnderAgreement address: ${await SharesUnderAgreement.getAddress()}\n`
    );
  } else {
    console.log(
      `\nSharesUnderAgreement is already deployed. Checking if bridging infrastructure is alos deployed...`
    );
    // check if user has already deployed infrastructure from source chain:
    // if so, he needs to call ccip-update.. or related name (yet TODO)
    // instead of deplying new
    SharesUnderAgreement = await sourceConnection.ethers.getContractAt(
      "SharesUnderAgreement",
      _taskArguments.sha
    );

    // check from source pool
    // TODO
    // if true error message and throw
    console.log(`No infrastructure deployed.\n`);
  }

  // TODO multiple deployments if multiple chain are requested to be implemented
  // user passes list of chains, here we loop and collected per chain BridgedSharesUnderAgreement
  // then passed to factory
  // deploy bridged token to destination
  console.log(
    `\nDeploying BridgedSharesUnderAgreement on ${networkNameDestination}...`
  );
  const { BridgedSharesUnderAgreement } =
    await destinationConnection.ignition.deploy(
      (
        await import("../../ignition/modules/shares/BridgedSHAModule.ts")
      ).default,
      {
        deploymentId: getBridgedSharesDeploymentName(networkNameSource),

        parameters: {
          SHAModule: {
            SYMBOL: _taskArguments.symbol,
            NAME: _taskArguments.name,
            TERMS: _taskArguments.terms,
          },
        },

        displayUi: true,
      }
    );
  console.log(
    `BridgedSharesUnderAgreement deployed on ${networkNameDestination}, address: ${await BridgedSharesUnderAgreement.getAddress()}\n`
  );

  // load Artifacts
  console.log(
    `Loading LockReleaseTokenPool and BurnMintTokenPool artifacts...`
  );
  const lockReleaseTokenPoolArtifact = await _hre.artifacts.readArtifact(
    "LockReleaseTokenPool"
  );
  const burnMintTokenPoolArtifact = await _hre.artifacts.readArtifact(
    "BurnMintTokenPool"
  );
  console.log(`Artifacts loaded`);

  // predict LockReleaseTokenPool
  console.log(`Predicting LockReleaseTokenPool Address...`);
  const [signer] = await sourceConnection.ethers.getSigners();
  const tokenPoolFactory =
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource].tokenPoolFactory;
  const predictedLockReleaseTokenPool = predictTokenPoolAddress(
    tokenPoolFactory,
    CREATE2_SALT,
    await signer.getAddress(),
    await SharesUnderAgreement.getAddress(),
    decimals,
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource].rmnProxy,
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource].router,
    lockReleaseTokenPoolArtifact.bytecode,
    PoolType.LOCK_RELEASE
  );
  console.log(`Predicted Address: ${predictedLockReleaseTokenPool}`);

  // LockReleaseDeployment via TokenPoolFactory
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/TokenPoolFactoryModule.ts")
    ).default,
    {
      deploymentId: getFactoryDeploymentName(networkNameSource),

      parameters: {
        TokenPoolFactoryModule: {
          sharesUnderAgreement: await SharesUnderAgreement.getAddress(),
          decimals: decimals,
          remoteTokenAddress: await BridgedSharesUnderAgreement.getAddress(),

          // source
          tokenPoolFactory: tokenPoolFactory,

          // destination
          destinationChainSelector:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
              .remoteChainSelector,
          destinationPoolFactory:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
              .tokenPoolFactory,
          destinationRouter:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
              .router,
          destinationRMNProxy:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
              .rmnProxy,

          // bytecodes
          lockReleaseTokenPoolBytecode: lockReleaseTokenPoolArtifact.bytecode,
          burnMintTokenPoolBytecode: burnMintTokenPoolArtifact.bytecode,
        },
      },

      displayUi: true,
    }
  );

  // TokenPoolFactory Deployment Settings
  // ID for ignition ccip is of type: ccip-testnet-[source-network]
  // needed for handy subsequent usage of ccip hardhat tasks
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/SourceChainSettingsModule.ts")
    ).default,
    {
      deploymentId: getSettingsDeploymentName(networkNameSource),

      parameters: {
        SourceChainModule: {
          sharesUnderAgreement: await SharesUnderAgreement.getAddress(),
          lockReleaseTokenPool: predictedLockReleaseTokenPool,
          registryModuleOwner:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource]
              .registryModuleOwner,
          tokenAdminRegistry:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource]
              .tokenAdminRegistry,
        },
      },

      displayUi: true,
    }
  );

  // // ID for ignition ccip is of type: ccip-testnet-[destination-network]
  // // needed for handy subsequent usage of ccip hardhat tasks
  // await destinationConnection.ignition.deploy(
  //   (
  //     await import("../../ignition/modules/ccip/DestinationChainModule.js")
  //   ).default,
  //   {
  //     deploymentId: getDeploymentName(networkNameDestination),

  //     parameters: {
  //       DestinationChainModule: {
  //         // BSHA contructor parameter must match
  //         // the one used to predict it earlier
  //         TERMS: TERMS,
  //         decimals: decimals,

  //         // destination
  //         tokenAdminRegistry:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
  //             .tokenAdminRegistry,
  //         registryModuleOwner:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
  //             .registryModuleOwner,
  //         tokenPoolFactory:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameDestination]
  //             .tokenPoolFactory,

  //         // source
  //         sourceChainSelector:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource]
  //             .remoteChainSelector,
  //         sourcePoolFactory:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource]
  //             .tokenPoolFactory,
  //         sourceRouter:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource].router,
  //         sourceRMNProxy:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[networkNameSource].rmnProxy,

  //         // Bytecode can be substituted by exact addresses
  //         remotePoolAddress: await LockReleaseTokenPool.getAddress(),
  //         remoteTokenAddress: await LockReleaseTokenPool.getAddress(),

  //         // bytecode
  //         burnMintTokenPoolBytecode: burnMintTokenPoolArtifact.bytecode,
  //       },
  //     },

  //     displayUi: true,
  //   }
  // );

  return successfulResult([]);
}
