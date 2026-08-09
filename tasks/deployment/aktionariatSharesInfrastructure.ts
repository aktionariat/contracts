/**
 * Deployment of Shares, SHA and BSHA for selected networks.
 * If prompted it deploys and does setup also for Factories on both, source and destination networks.
 */
import { ethers, id } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";

import FACTORIES_STORAGE from "./const/factories.ts";

import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "../ccip/const/CCIPAddresses.ts";
import { printAndReturnErrorResult } from "../utils/error.ts";
import { CCIPNetwork } from "../ccip/types/infrastructureAddresses.ts";

import {
  BridgedSharesUnderAgreementDeploymentData,
  ChainlinkAddresses,
  SharesUnderAgreementDeploymentData,
  SharesDeploymentData,
} from "../../ignition/modules/factory/lib/types.ts";
import {
  PoolType,
  RemoteTokenPoolInfo,
} from "../../ignition/modules/ccip/lib/types.ts";

import { prettyStringifyObject } from "../utils/json.ts";
import { NetworkConnection } from "hardhat/types/network";

import { readNonce, increaseNonce } from "./lib/nonce.ts";

// main logic addresses to be set
let sharesLogicAddress: string;
let shaLogicAddress: string;
let lrPoolLogicAddress: string;

const NAME = "Microstrategy Shares";
let SYMBOL = "MSTR";
const TERMS = "Terms";

// one each network
const BSHA_PARAMETERS: {
  [key in CCIPNetwork]?: { bNAME: string; bSYMBOL: string; bTERMS: string };
} = {
  baseSepolia: {
    bNAME: "Bridged Base Sepolia Microstrategy Shares",
    bSYMBOL: "bMSTR",
    bTERMS: "Bridged Base Sepolia Terms",
  },
};

interface AktionariatSharesInfrastructureArguments {
  source: string;
  destination: string; // of type "[net]-[net]-...-[net]"
  sha?: string; // TODO should not make deployment etc..
  bsha?: string; // TODO should be made array etc..
  nonce: boolean;
}

// Note for address prediction:
//
//    We need to predict either:
//      - destination token and token pool
//      - source token and token pool
//
// We currently give a custom meaning to the initCode
// of tokena dn token pool of the token pools struct
// given by chainlink. So that you don't have to directly
// predict them but the contract does. This has a caviat
// it enforces you to use the same salt for source and all
// destinations deployments.

export default async function (
  _taskArguments: AktionariatSharesInfrastructureArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  // read nonce
  if (_taskArguments.nonce) {
    await increaseNonce();
  }
  const NONCE = await readNonce();
  SYMBOL += `-${NONCE}`;

  const SALT = id(SYMBOL);

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
  if (
    _taskArguments.destination
      .split("-")
      .reduce((prev, v) => prev || !(v in BSHA_PARAMETERS), false)
  ) {
    return printAndReturnErrorResult(
      `One of networks "${_taskArguments.destination}" does not define its BSHA parameters`
    );
  }
  const destinationNetworkNames: CCIPNetwork[] =
    _taskArguments.destination.split("-") as CCIPNetwork[];

  console.log(`\n\nConnecting to networks...`);
  console.log(`\tTo ${sourceNetworkName}...`);
  const sourceConnection = await _hre.network.create({
    network: sourceNetworkName,
  });

  const tmpDestinationConnections: {
    [key in CCIPNetwork]?: NetworkConnection<"generic">;
  } = {};
  for (let net of destinationNetworkNames) {
    console.log(`\tTo ${net}...`);
    tmpDestinationConnections[net] = await _hre.network.create({
      network: net,
    });
  }
  const destinationConnections = tmpDestinationConnections as {
    [key in CCIPNetwork]: NetworkConnection<"generic">;
  };
  console.log(`All networks connected`);

  // Factories
  // if possible are collected from tasks/deployment/const/factories
  let sourceFactory: string =
    FACTORIES_STORAGE[sourceNetworkName as keyof typeof FACTORIES_STORAGE];
  if (!sourceFactory) {
    // no source factory, so we try set it up
    console.log(
      `\n\nDeploying Source network ${sourceNetworkName} Infrastructure`
    );

    // to do so we first need to deploy Shares, SharesUnderAgreement
    // we don't care about infos
    console.log(`\tDeploying Shares, SHA Artifacts on ${sourceNetworkName}...`);
    const {
      Shares: SharesLogic,
      SharesUnderAgreement: SharesUnderAgreementLogic,
    } = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/shares/SHAModule.ts")
      ).default,
      {
        deploymentId: `factory-shares-logic-source-${sourceNetworkName}`,
        displayUi: true,

        parameters: {
          SHAModule: {
            SYMBOL,
            NAME,
            TERMS,
          },
        },
      }
    );
    sharesLogicAddress = await SharesLogic.getAddress();
    shaLogicAddress = await SharesUnderAgreementLogic.getAddress();
    console.log(`\tDeployed Artifacts on ${sourceNetworkName}`);

    console.log(
      `\tDeploying LockReleasetokenPool Artifact on ${sourceNetworkName}...`
    );
    const { LockReleaseTokenPoolProxy: LockReleaseTokenPoolProxyLogic } =
      await sourceConnection.ignition.deploy(
        (
          await import(
            "../../ignition/modules/pools/LockReleaseTokenPoolProxyModule.ts"
          )
        ).default,
        {
          deploymentId: `factory-tkp-lock-release-logic-source-${sourceNetworkName}`,
          displayUi: true,

          parameters: {
            LockReleaseTokenPoolProxyModule: {
              // correct but still mock data
              token: await SharesUnderAgreementLogic.getAddress(),
              localTokenDecimals: 0,
              allowlist: [],
              rmnProxy:
                CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
                  .rmnProxy,
              acceptLiquidity: true,
              router:
                CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
            },
          },
        }
      );
    lrPoolLogicAddress = await LockReleaseTokenPoolProxyLogic.getAddress();
    console.log(`\tDeployed Artifact on ${sourceNetworkName}`);

    // then we deploy the factory with related addresses
    console.log(`\tDeploying Factory Source on ${sourceNetworkName}...`);
    const { FactorySource } = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/factory/SourceFactoryModule.ts")
      ).default,
      {
        deploymentId: `factory-source-${sourceNetworkName}`,
        displayUi: true,

        parameters: {
          SourceFactoryModule: {
            sharesLogicContract: sharesLogicAddress,
            shaLogicContract: shaLogicAddress,
            tokenPoolLogicContract: lrPoolLogicAddress,
          },
        },
      }
    );
    console.log(`\tDeployed Factory Source`);

    sourceFactory = await FactorySource.getAddress();
  }

  console.log(
    `\n\nDeploying Destination Infrastructure on missing networks...`
  );
  const tmpBshaLogicAddresses: {
    [key in CCIPNetwork]?: string;
  } = {};
  const tmpBmPoolLogicAddresses: {
    [key in CCIPNetwork]?: string;
  } = {};
  const tmpDestinationFactories: {
    [key in CCIPNetwork]?: string;
  } = {};
  const missingNetworks: CCIPNetwork[] = [];
  for (const net of destinationNetworkNames) {
    if (net in FACTORIES_STORAGE) {
      tmpDestinationFactories[net as keyof typeof tmpDestinationFactories] =
        FACTORIES_STORAGE[net as keyof typeof FACTORIES_STORAGE];
    } else {
      missingNetworks.push(net);
    }
  }

  // networks that are missing a factory
  let bshaLogicAddress: string;
  let bmPoolLogicAddress: string;
  if (missingNetworks.length > 0) {
    for (const net of missingNetworks) {
      // deploy
      console.log(`\tDeploying BSHA Artifact on ${net}...`);
      const { BridgedSharesUnderAgreement: BridgedSharesUnderAgreementLogic } =
        await destinationConnections[net].ignition.deploy(
          (
            await import("../../ignition/modules/shares/BridgedSHAModule.ts")
          ).default,
          {
            deploymentId: `factory-bsha-logic-destination-${net}`,
            displayUi: true,

            parameters: {
              SHAModule: {
                SYMBOL,
                NAME,
                TERMS,
              },
            },
          }
        );
      bshaLogicAddress = await BridgedSharesUnderAgreementLogic.getAddress();
      console.log(`\tDeployed Artifact on ${net}`);

      console.log(`\tDeploying BurnMintTokenPoolProxy Artifact on ${net}...`);
      const { BurnMintTokenPoolProxy: BurnMintTokenPoolProxyLogic } =
        await destinationConnections[net].ignition.deploy(
          (
            await import(
              "../../ignition/modules/pools/BurnMintTokenPoolProxyModule.ts"
            )
          ).default,
          {
            deploymentId: `factory-tkp-burn-mint-logic-destination-${net}`,
            displayUi: true,

            parameters: {
              BurnMintTokenPoolProxyModule: {
                // correct but still mock data
                token: bshaLogicAddress,
                localTokenDecimals: 0,
                allowlist: [],
                rmnProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].rmnProxy,
                router: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].router,
              },
            },
          }
        );
      bmPoolLogicAddress = await BurnMintTokenPoolProxyLogic.getAddress();
      console.log(`\tDeployed Artifact on ${net}`);

      // deploy
      console.log(`\tDeploying Factory Destination on ${net}...`);
      const { FactoryDestination } = await destinationConnections[
        net
      ].ignition.deploy(
        (
          await import(
            "../../ignition/modules/factory/DestinationFactoryModule.ts"
          )
        ).default,
        {
          deploymentId: `factory-destination-${net}`,

          parameters: {
            DestinationFactoryModule: {
              bshaLogicContract: bshaLogicAddress,
              tokenPoolLogicContract: bmPoolLogicAddress,
            },
          },

          displayUi: true,
        }
      );
      console.log(`Deployed Factory Destination on ${net}`);

      // set
      const destinationFactoryAddress = await FactoryDestination.getAddress();
      console.log(
        `Consider adding factory: ${destinationFactoryAddress} to network: ${net} within FACTORIES_STORAGE object`
      );

      tmpBshaLogicAddresses[net] = bshaLogicAddress;
      tmpBmPoolLogicAddresses[net] = bmPoolLogicAddress;
      tmpDestinationFactories[net] = destinationFactoryAddress;
    }
  } else {
    // should collect implementation addresses from factory
  }
  const bshaLogicAddresses = tmpBshaLogicAddresses as {
    [key in CCIPNetwork]: string;
  };
  const bmPoolLogicAddresses = tmpBmPoolLogicAddresses as {
    [key in CCIPNetwork]: string;
  };
  const destinationFactories = tmpDestinationFactories as {
    [key in CCIPNetwork]: string;
  };
  console.log("All Destination factories have been deployed");

  let sharesUnderAgreement = _taskArguments.sha ?? ethers.ZeroAddress;
  if (sharesUnderAgreement != ethers.ZeroAddress) {
    console.log(
      `\n\nMake sure that for SharesUnderAgreement: ${sharesUnderAgreement} the owner is the destination factory`
    );
  }

  // // source chain data
  // either pulled from SHA or deployed
  let sharesDeploymentData: SharesDeploymentData = {
    candidate: ethers.ZeroAddress,
    symbol: SYMBOL,
    name: NAME,
    terms: TERMS,
  };
  let sharesUnderAgreementDeploymentData: SharesUnderAgreementDeploymentData = {
    candidate: ethers.ZeroAddress,
    terms: TERMS,
  };
  let chainlinkAddresses: ChainlinkAddresses = {
    tokenAdminRegistry:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .tokenAdminRegistry,
    registryModuleOwner:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .registryModuleOwner,
    rmnProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].rmnProxy,
    router: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
  };
  let remoteTokenPools: RemoteTokenPoolInfo[] = [];

  for (let net of destinationNetworkNames) {
    remoteTokenPools.push({
      remoteChainSelector:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].remoteChainSelector,

      // we let contract predict it
      // to predict it we custom store prediction parameters in remotePoolInitCode, see TokenPoolInitialization.sol
      remotePoolAddress: "0x", // bytes
      remotePoolInitCode: bmPoolLogicAddresses[net], // bytes

      remoteChainConfig: {
        remotePoolFactory: destinationFactories[net],
        remoteRouter: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].router,
        remoteRMNProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].rmnProxy,
        remoteTokenDecimals: 0, // can be hardcoded to zero
      },

      // remote pool type
      poolType: PoolType.BURN_MINT,

      // we let contract predict it
      // to predict it we custom store destination implementation address in remoteTokenInitCode, see TokenPoolInitialization.sol
      remoteTokenAddress: "0x", // bytes
      remoteTokenInitCode: bshaLogicAddresses[net], // bytes

      rateLimiterConfig: {
        isEnabled: false,
        capacity: 0n,
        rate: 0n,
      },
    });
  }

  const SourceFactoryDeploySharesModuleInput = {
    sourceFactory,
    sharesDeploymentData,
    sharesUnderAgreementDeploymentData,
    chainlinkAddresses,
    remoteTokenPools,
    futureOwner: ethers.ZeroAddress,
    salt: SALT,
  };

  // deploying on source chain
  console.log(`\n\nDeploying Proxy Shares and SHA on ${sourceNetworkName}...`);
  console.log(
    `Input parameters:\n${prettyStringifyObject(
      SourceFactoryDeploySharesModuleInput
    )}`
  );
  const { Shares, SharesUnderAgreement, LockReleaseTokenPool } =
    await sourceConnection.ignition.deploy(
      (
        await import(
          "../../ignition/modules/factory/SourceFactoryDeploySharesModule.ts"
        )
      ).default,
      {
        deploymentId: `factory-source-deploy-${sourceNetworkName}`,

        parameters: {
          SourceFactoryDeploySharesModule: SourceFactoryDeploySharesModuleInput,
        },

        displayUi: true,
      }
    );
  console.log(`Deployed on ${sourceNetworkName}`);

  //
  //
  // Now destination
  //
  //

  // formatting needed addresses to bytes
  const lsbBytesSharesUnderAgreement =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [await SharesUnderAgreement.getAddress()]
    );
  console.log(`lsbBytesSharesUnderAgreement: ${lsbBytesSharesUnderAgreement}`);

  const lsbBytesLockReleaseTokenPool =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [await LockReleaseTokenPool.getAddress()]
    );
  console.log(`lsbBytesLockReleaseTokenPool: ${lsbBytesLockReleaseTokenPool}`);

  // keep track of bsha and their token pools
  //@ts-expect-error
  const bshaAddresses: { [key in CCIPNetwork]: string } = {};
  //@ts-expect-error
  const burnMintPoolAddresses: { [key in CCIPNetwork]: string } = {};

  for (let net of destinationNetworkNames) {
    let factoryDestination = destinationFactories[net];

    let bridgedSharesUnderAgreementDeploymentData: BridgedSharesUnderAgreementDeploymentData =
      {
        candidate: ethers.ZeroAddress,
        symbol: BSHA_PARAMETERS[net]!.bSYMBOL,
        name: BSHA_PARAMETERS[net]!.bNAME,
        terms: BSHA_PARAMETERS[net]!.bTERMS,
      };

    chainlinkAddresses = {
      tokenAdminRegistry:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].tokenAdminRegistry,
      registryModuleOwner:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].registryModuleOwner,
      rmnProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].rmnProxy,
      router: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].router,
    };
    remoteTokenPools = [
      {
        remoteChainSelector:
          CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
            .remoteChainSelector,

        // we know it
        remotePoolAddress: lsbBytesLockReleaseTokenPool, // bytes
        remotePoolInitCode: "0x", // bytes

        remoteChainConfig: {
          remotePoolFactory: sourceFactory,
          remoteRouter:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
          remoteRMNProxy:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].rmnProxy,
          remoteTokenDecimals: 0, // can be hardcoded to zero
        },

        // remote pool type
        poolType: PoolType.LOCK_RELEASE,

        // we know it
        remoteTokenAddress: lsbBytesSharesUnderAgreement, // bytes
        remoteTokenInitCode: "0x", // bytes

        rateLimiterConfig: {
          isEnabled: false,
          capacity: 0n,
          rate: 0n,
        },
      },
    ];

    const DestinationFactoryDeployBridgedSharesModuleInput = {
      factoryDestination,
      bridgedSharesUnderAgreementDeploymentData,
      chainlinkAddresses,
      remoteTokenPools,
      futureOwner: ethers.ZeroAddress,
      salt: SALT,
    };

    console.log(`\n\nDeploying bSHA on ${net}...`);
    console.log(
      `Input parameters:\n${prettyStringifyObject(
        DestinationFactoryDeployBridgedSharesModuleInput
      )}`
    );
    const { BridgedSharesUnderAgreement, BurnMintTokenPool } =
      await destinationConnections[net].ignition.deploy(
        (
          await import(
            "../../ignition/modules/factory/DestinationFactoryDeployBridgedSharesModule.ts"
          )
        ).default,
        {
          deploymentId: `factory-destination-deploy-${net}`,

          parameters: {
            DestinationFactoryDeployBridgedSharesModule:
              DestinationFactoryDeployBridgedSharesModuleInput,
          },

          displayUi: true,
        }
      );

    bshaAddresses[net] = await BridgedSharesUnderAgreement.getAddress();
    burnMintPoolAddresses[net] = await BurnMintTokenPool.getAddress();
    console.log(`Deployed on ${net}`);
  }

  // // Later accept ownerhips in source
  // Then you need to accept ownership of
  // LockReleaseTokenPool, BurnMintTokenPool and chains' TokenAdminRegistry for each respective token (SHA and bSHA)
  console.log(
    `\n\nAccepting TokenPool and TokenAdminRegistry ownership of SHA on ${sourceNetworkName}...`
  );
  await sourceConnection.ignition.deploy(
    (
      await import(
        "../../ignition/modules/factory/AcceptOwnershipAfterFactoryModule.ts"
      )
    ).default,
    {
      deploymentId: `factory-source-ownership-acceptance-${sourceNetworkName}`,

      parameters: {
        AcceptOwnershipAfterFactoryModule: {
          tokenPool: await LockReleaseTokenPool.getAddress(),
          localTokenAdminRegistry:
            CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
              .tokenAdminRegistry,
          localToken: await SharesUnderAgreement.getAddress(),
        },
      },

      displayUi: true,
    }
  );
  console.log(`Ownership accepted`);

  // // Later accept ownerhips in destination
  for (let net of destinationNetworkNames) {
    console.log(
      `\n\nAccepting TokenPool and TokenAdminRegistry ownership of bSHA on ${net}...`
    );
    await destinationConnections[net].ignition.deploy(
      (
        await import(
          "../../ignition/modules/factory/AcceptOwnershipAfterFactoryModule.ts"
        )
      ).default,
      {
        deploymentId: `factory-destination-ownership-acceptance-${net}`,

        parameters: {
          AcceptOwnershipAfterFactoryModule: {
            tokenPool: burnMintPoolAddresses[net],
            localTokenAdminRegistry:
              CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].tokenAdminRegistry,
            localToken: bshaAddresses[net],
          },
        },

        displayUi: true,
      }
    );
    console.log(`Ownership accepted`);
  }

  return successfulResult([]);
}
