/**
 * Deployment of Shares, SHA and BSHA for selected networks.
 * If prompted it deploys and does setup also for Factories on both, source and destination networks.
 */
import { ethers } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";

import FACOTIRES_STORAGE from "./const/factories.ts";

import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "../ccip/const/CCIPAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import { CCIPNetwork } from "../ccip/types/infrastructureAddresses.ts";

import {
  BridgedSharesUnderAgreementDeploymentData,
  ChainlinkAddresses,
  DeploymentData,
  SharesUnderAgreementDeploymentData,
  PoolType,
  RemoteTokenPoolInfoSolidityParameter,
} from "../../ignition/modules/ccip/lib/types.ts";
import { CREATE2_SALT } from "../../ignition/modules/ccip/lib/config.ts";
import { predictTokenPoolAddress } from "../../ignition/modules/ccip/lib/tokenPool.ts";
import { predictBridgedSharesAddress } from "../utils/predictions.ts";
import { prettyStringifyObject } from "../utils/json.ts";
import { NetworkConnection } from "hardhat/types/network";

interface AktionariatSharesInfrastructureArguments {
  source: string;
  destination: string; // of type "[net]-[net]-...-[net]"
  sha?: string;
  bsha?: string;
}

export default async function (
  _taskArguments: AktionariatSharesInfrastructureArguments,
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

  // destinations can be multiple, of form "[net]-[net]-..."
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
  const destinationNetworkNames: CCIPNetwork[] =
    _taskArguments.destination.split("-") as CCIPNetwork[];

  console.log(`\n\nConnecting to networks...`);
  console.log(`\tTo ${sourceNetworkName}...`);
  const sourceConnection = await _hre.network.create({
    network: sourceNetworkName,
  });
  const [signer] = await sourceConnection.ethers.getSigners();

  const destinationConnections: NetworkConnection<"generic">[] = [];
  for (let destinationNetworkName in destinationNetworkNames) {
    console.log(`\tTo ${destinationNetworkName}...`);
    destinationConnections.push(
      await _hre.network.create({
        network: destinationNetworkName,
      })
    );
  }
  console.log(`All networks connected`);

  // Factories
  // if possible are collected from tasks/deployment/const/factories
  let sourceFactory: string =
    FACOTIRES_STORAGE[sourceNetworkName as keyof typeof FACOTIRES_STORAGE];
  if (!sourceFactory) {
    // no source factory, so we try set it up

    // to do so we first need to deploy Shares, SharesUnderAgreement and TokenPoolLogics
    console.log(
      `\n\nDeploying Shares, SHA and LockReleaseTokenPoolAktionariat Artifacts on ${sourceNetworkName}...`
    );
    const { FactorySource } = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/ccip/SourceFactoryModule.ts")
      ).default,
      {
        deploymentId: `source-factory-${sourceNetworkName}`,
        displayUi: true,
      }
    );
    console.log(`Deployed Factory Source`);

    // then we deploy the factory with related addresses
    console.log(`\n\nDeploying Factory Source on ${sourceNetworkName}...`);
    const { FactorySource } = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/ccip/SourceFactoryModule.ts")
      ).default,
      {
        deploymentId: `source-factory-${sourceNetworkName}`,
        displayUi: true,
      }
    );
    console.log(`Deployed Factory Source`);

    sourceFactory = await FactorySource.getAddress();
  }

  let destinationFactory = _taskArguments.destinationFactory;
  if (!destinationFactory) {
    console.log(
      `\n\nDeploying Factory Destination on ${destinationNetworkName}...`
    );
    const { FactoryDestination } = await destinationConnection.ignition.deploy(
      (
        await import("../../ignition/modules/ccip/DestinationFactoryModule.ts")
      ).default,
      {
        deploymentId: `ccip-destination-factory-${destinationNetworkName}`,
        displayUi: true,
      }
    );
    console.log(`Deployed Factory Destination`);

    destinationFactory = await FactoryDestination.getAddress();
  }

  //   // check shares and sha
  //   const sharesArtifact = await _hre.artifacts.readArtifact("Shares");
  //   // whatever the address we build it
  //   let sharesConstructorArgumentsBytecode = "0x";
  //   const symbol = "MSTR";
  //   const name = "Microstrategy Token";
  //   const terms = "https://example.com/terms";
  //   const owner = await signer.getAddress();

  //   const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  //   sharesConstructorArgumentsBytecode = abiCoder.encode(
  //     ["string", "string", "string", "address"],
  //     [symbol, name, terms, owner]
  //   );

  //   let sharesUnderAgreement = _taskArguments.sha;
  //   if (sharesUnderAgreement) {
  //     console.log(
  //       `\n\nMake sure that for SharesUnderAgreement: ${sharesUnderAgreement} the owner is the destination factory`
  //     );
  //   }

  //   const sharesUnderAgreementArtifact = await _hre.artifacts.readArtifact(
  //     "SharesUnderAgreement"
  //   );
  //   // no need for sha constructor arguments
  //   const sharesUnderAgreementTerms = "sha terms";

  //   // check bsha
  //   let bridgedSharesUnderAgreement = _taskArguments.bsha;
  //   if (bridgedSharesUnderAgreement) {
  //     console.log(
  //       `\n\nMake sure that for BridgedSharesUnderAgreement: ${bridgedSharesUnderAgreement} the owner is the destination factory`
  //     );
  //   }
  //   const bridgedSharesUnderAgreementArtifact = await _hre.artifacts.readArtifact(
  //     "BridgedSharesUnderAgreement"
  //   );

  //   // load Artifacts
  //   console.log(`\n\nLoading artifacts...`);
  //   console.log(`lockReleaseTokenPoolArtifact...`);
  //   const lockReleaseTokenPoolArtifact = await _hre.artifacts.readArtifact(
  //     "LockReleaseTokenPool"
  //   );
  //   const sourcePoolType = PoolType.LOCK_RELEASE;
  //   console.log(`burnMintTokenPoolArtifact...`);
  //   const burnMintTokenPoolArtifact = await _hre.artifacts.readArtifact(
  //     "BurnMintTokenPool"
  //   );
  //   const destinationPoolType = PoolType.BURN_MINT;
  //   console.log(`Artifacts loaded`);

  //   // // Predictions
  //   console.log(`\n\nPredicting Addresses...`);
  //   console.log(`Predicting BridgedSharesUnderAgreement Address...`);
  //   const predictedBridgedSharesUnderAgreementAddress =
  //     predictBridgedSharesAddress(
  //       destinationFactory,
  //       CREATE2_SALT,
  //       bridgedSharesUnderAgreementArtifact.bytecode,
  //       "b" + symbol,
  //       "Bridged " + name,
  //       "Bridged " + terms,
  //       destinationFactory
  //     );
  //   console.log(
  //     `Predicted BridgedSharesUnderAgreement Address: ${predictedBridgedSharesUnderAgreementAddress}`
  //   );

  //   console.log(`Predicting BurnMintTokenPool Address...`);
  //   // TODO multiple predictions deployments if multiple chain are requested to be implemented
  //   const predictedBurnMintTokenPoolAddress = predictTokenPoolAddress(
  //     CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //       .tokenPoolFactory,
  //     CREATE2_SALT,
  //     destinationFactory,
  //     bridgedSharesUnderAgreement ?? predictedBridgedSharesUnderAgreementAddress,
  //     0,
  //     CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].rmnProxy,
  //     CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].router,
  //     burnMintTokenPoolArtifact.bytecode,
  //     PoolType.BURN_MINT
  //   );
  //   console.log(
  //     `Predicted BurnMintTokenPool Address: ${predictedBurnMintTokenPoolAddress}`
  //   );

  //   // // computing padded addresses
  //   console.log(`Computing LSB encoded addresses...`);
  //   const lsbBytesBridgedSharesUnderAgreement =
  //     sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
  //       ["address"],
  //       [
  //         bridgedSharesUnderAgreement ??
  //           predictedBridgedSharesUnderAgreementAddress,
  //       ]
  //     );
  //   console.log(
  //     `lsbBytesBridgedSharesUnderAgreement: ${lsbBytesBridgedSharesUnderAgreement}`
  //   );

  //   const lsbBytesBurnMintTokenPool =
  //     sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
  //       ["address"],
  //       [predictedBurnMintTokenPoolAddress]
  //     );
  //   console.log(`lsbBytesBurnMintTokenPool: ${lsbBytesBurnMintTokenPool}`);

  //   // Then within source factory, you need to read events and return
  //   // SHA address and token pool address

  //   // // source chain data
  //   let factorySource: string = sourceFactory;
  //   // either pulled from SHA or deployed
  //   let sharesTokenDeploymentData: DeploymentData = {
  //     candidate: ethers.ZeroAddress,
  //     contractBytecode: sharesArtifact.bytecode,
  //     constructorArgumentsBytecode: sharesConstructorArgumentsBytecode,
  //   };
  //   let sharesUnderAgreementDeploymentDataSHA: SharesUnderAgreementDeploymentData =
  //     {
  //       candidate: sharesUnderAgreement ?? ethers.ZeroAddress,
  //       contractBytecode: sharesUnderAgreementArtifact.bytecode,
  //       terms: sharesUnderAgreementTerms,
  //     };
  //   let lockReleaseTokenPoolBytecode = lockReleaseTokenPoolArtifact.bytecode;
  //   let chainlinkAddresses: ChainlinkAddresses = {
  //     tokenAdminRegistry:
  //       CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
  //         .tokenAdminRegistry,
  //     registryModuleOwner:
  //       CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
  //         .registryModuleOwner,
  //     tokenPoolFactory:
  //       CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].tokenPoolFactory,
  //   };
  //   let remoteTokenPools: RemoteTokenPoolInfoSolidityParameter[] = [
  //     {
  //       remoteChainSelector:
  //         CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //           .remoteChainSelector,

  //       // we predict it beforehand
  //       remotePoolAddress: lsbBytesBurnMintTokenPool, // bytes
  //       remotePoolInitCode: "0x", // bytes

  //       remoteChainConfig: {
  //         remotePoolFactory:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //             .tokenPoolFactory,
  //         remoteRouter:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].router,
  //         remoteRMNProxy:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //             .rmnProxy,
  //         remoteTokenDecimals: 0, // can be hardcoded to zero
  //       },

  //       // remote pool type
  //       poolType: destinationPoolType,

  //       // we predict it beforehand
  //       remoteTokenAddress: lsbBytesBridgedSharesUnderAgreement, // bytes
  //       remoteTokenInitCode: "0x", // bytes

  //       rateLimiterConfig: {
  //         isEnabled: false,
  //         capacity: 0n,
  //         rate: 0n,
  //       },
  //     },
  //   ];

  //   // reused also for destination
  //   let salt: string = CREATE2_SALT;
  //   let futureOwner: string = ethers.ZeroAddress;

  //   const SourceFactoryDeploySharesModuleInput = {
  //     factorySource,
  //     sharesTokenDeploymentData,
  //     sharesUnderAgreementDeploymentDataSHA,
  //     lockReleaseTokenPoolBytecode,
  //     chainlinkAddresses,
  //     remoteTokenPools,
  //     salt,
  //     futureOwner,
  //   };

  //   // const artifact = await _hre.artifacts.readArtifact("FactorySource");
  //   // const deployFn = artifact.abi.find((f: any) => f.name === "deploy");
  //   // console.log(JSON.stringify(deployFn.inputs, null, 2));

  //   // deploying on source chain
  //   console.log(`\n\nDeploying Shares and SHA on ${sourceNetworkName}...`);
  //   console.log(
  //     `Input parameters:\n${prettyStringifyObject(
  //       SourceFactoryDeploySharesModuleInput
  //     )}`
  //   );
  //   const { Shares, SharesUnderAgreement, LockReleaseTokenPool } =
  //     await sourceConnection.ignition.deploy(
  //       (
  //         await import(
  //           "../../ignition/modules/ccip/SourceFactoryDeploySharesModule.ts"
  //         )
  //       ).default,
  //       {
  //         deploymentId: "ccip-source-factory-deploy-shares-module",

  //         parameters: {
  //           SourceFactoryDeploySharesModule: SourceFactoryDeploySharesModuleInput,
  //         },

  //         displayUi: true,
  //       }
  //     );
  //   console.log(`Deployed on ${sourceNetworkName}`);

  //   //
  //   //
  //   // Now destination
  //   //
  //   //

  //   // formatting needed addresses to bytes
  //   const lsbBytesSharesUnderAgreement =
  //     sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
  //       ["address"],
  //       [await SharesUnderAgreement.getAddress()]
  //     );
  //   console.log(`lsbBytesSharesUnderAgreement: ${lsbBytesSharesUnderAgreement}`);

  //   const lsbBytesLockReleaseTokenPool =
  //     sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
  //       ["address"],
  //       [await LockReleaseTokenPool.getAddress()]
  //     );
  //   console.log(`lsbBytesLockReleaseTokenPool: ${lsbBytesLockReleaseTokenPool}`);

  //   let factoryDestination = destinationFactory;
  //   let bridgedSharesUnderAgreementDeploymentData: BridgedSharesUnderAgreementDeploymentData =
  //     {
  //       candidate: bridgedSharesUnderAgreement ?? ethers.ZeroAddress,
  //       contractBytecode: bridgedSharesUnderAgreementArtifact.bytecode,

  //       symbol: "b" + symbol,
  //       name: "Bridged " + name,
  //       terms: "Bridged " + terms,
  //     };
  //   let burnMintTokenPoolBytecode = burnMintTokenPoolArtifact.bytecode;
  //   chainlinkAddresses = {
  //     tokenAdminRegistry:
  //       CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //         .tokenAdminRegistry,
  //     registryModuleOwner:
  //       CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //         .registryModuleOwner,
  //     tokenPoolFactory:
  //       CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //         .tokenPoolFactory,
  //   };
  //   remoteTokenPools = [
  //     {
  //       remoteChainSelector:
  //         CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
  //           .remoteChainSelector,

  //       // we predict it beforehand
  //       remotePoolAddress: lsbBytesLockReleaseTokenPool, // bytes
  //       remotePoolInitCode: "0x", // bytes

  //       remoteChainConfig: {
  //         remotePoolFactory:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
  //             .tokenPoolFactory,
  //         remoteRouter:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
  //         remoteRMNProxy:
  //           CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].rmnProxy,
  //         remoteTokenDecimals: 0, // can be hardcoded to zero
  //       },

  //       // remote pool type
  //       poolType: sourcePoolType,

  //       // we predict it beforehand
  //       remoteTokenAddress: lsbBytesSharesUnderAgreement, // bytes
  //       remoteTokenInitCode: "0x", // bytes

  //       rateLimiterConfig: {
  //         isEnabled: false,
  //         capacity: 0n,
  //         rate: 0n,
  //       },
  //     },
  //   ];

  //   const DestinationFactoryDeployBridgedSharesModuleInput = {
  //     factoryDestination,
  //     bridgedSharesUnderAgreementDeploymentData,
  //     chainlinkAddresses,
  //     burnMintTokenPoolBytecode,
  //     remoteTokenPools,
  //     salt,
  //     futureOwner,
  //   };

  //   console.log(`\n\nDeploying bSHA on ${destinationNetworkName}...`);
  //   console.log(
  //     `Input parameters:\n${prettyStringifyObject(
  //       DestinationFactoryDeployBridgedSharesModuleInput
  //     )}`
  //   );
  //   const { BridgedSharesUnderAgreement, BurnMintTokenPool } =
  //     await destinationConnection.ignition.deploy(
  //       (
  //         await import(
  //           "../../ignition/modules/ccip/DestinationFactoryDeployBridgedSharesModule.ts"
  //         )
  //       ).default,
  //       {
  //         deploymentId: "ccip-destination-factory-deploy-bridged-shares-module",

  //         parameters: {
  //           DestinationFactoryDeployBridgedSharesModule:
  //             DestinationFactoryDeployBridgedSharesModuleInput,
  //         },

  //         displayUi: true,
  //       }
  //     );
  //   console.log(`Deployed on ${destinationNetworkName}`);

  //   // Then you need to accept ownership of
  //   // LockReleaseTokenPool, BurnMintTokenPool and chains' TokenAdminRegistry for each respective token (SHA and bSHA)
  //   console.log(
  //     `\n\nAccepting TokenPool and TokenAdminRegistry ownership of SHA on ${sourceNetworkName}...`
  //   );
  //   await sourceConnection.ignition.deploy(
  //     (
  //       await import(
  //         "../../ignition/modules/ccip/AcceptOwnershipAfterFactoryModule.ts"
  //       )
  //     ).default,
  //     {
  //       deploymentId: "ccip-source-ownership-acceptance",

  //       parameters: {
  //         AcceptOwnershipAfterFactoryModule: {
  //           tokenPool: await LockReleaseTokenPool.getAddress(),
  //           localTokenAdminRegistry:
  //             CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
  //               .tokenAdminRegistry,
  //           localToken: await SharesUnderAgreement.getAddress(),
  //         },
  //       },

  //       displayUi: true,
  //     }
  //   );
  //   console.log(`Ownership accepted`);

  //   console.log(
  //     `\n\nAccepting TokenPool and TokenAdminRegistry ownership of bSHA on ${destinationNetworkName}...`
  //   );
  //   await destinationConnection.ignition.deploy(
  //     (
  //       await import(
  //         "../../ignition/modules/ccip/AcceptOwnershipAfterFactoryModule.ts"
  //       )
  //     ).default,
  //     {
  //       deploymentId: "ccip-destination-ownership-acceptance",

  //       parameters: {
  //         AcceptOwnershipAfterFactoryModule: {
  //           tokenPool: await BurnMintTokenPool.getAddress(),
  //           localTokenAdminRegistry:
  //             CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
  //               .tokenAdminRegistry,
  //           localToken: await BridgedSharesUnderAgreement.getAddress(),
  //         },
  //       },

  //       displayUi: true,
  //     }
  //   );
  //   console.log(`Ownership accepted`);

  return successfulResult([]);
}
