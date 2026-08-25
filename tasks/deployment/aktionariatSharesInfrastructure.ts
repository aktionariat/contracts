/**
 * Deployment of Shares, SHA and BSHA for selected networks.
 * Deploys factories on source and destination chains, then uses them
 * to deploy tokens and token pools with predicted cross-chain addresses.
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
  DestinationChainlinkAddresses,
  SharesDeploymentData,
  SharesUnderAgreementDeploymentData,
  SourceChainlinkAddresses,
} from "../../ignition/modules/factory/lib/types.ts";
import {
  PoolType,
  RemoteTokenPoolInfo,
} from "../../ignition/modules/ccip/lib/types.ts";

import { prettyStringifyObject } from "../utils/json.ts";
import { NetworkConnection } from "hardhat/types/network";

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
// The new factories (FactorySource, FactoryDestination) take no constructor
// arguments and deploy tokens + pools via CREATE2 using externally provided
// bytecodes. This means:
//   - On the source chain we predict destination pool/token addresses using
//     the destination factory address + bytecode hashes, then pass them to
//     the source factory so the Chainlink token pool factory can verify.
//   - On the destination chain we pass the actual source pool/token addresses
//     (already deployed) since they are known at that point.
//
// The destination chain is deployed AFTER the source tokens (but BEFORE the
// source chain's remote token pool config is resolved), so we can use the
// actual source pool address. For the source chain, we predict destination
// addresses and pass them in the remoteTokenPools config.

export default async function (
  _taskArguments: AktionariatSharesInfrastructureArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
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

  // // Get pool bytecodes for CREATE2 address prediction
  const LockReleasePoolArtifact =
    await sourceConnection.ethers.getContractFactory("LockReleaseTokenPool");
  const BurnMintPoolArtifact = await sourceConnection.ethers.getContractFactory(
    "BurnMintTokenPool"
  );
  const lockReleaseBytecode = LockReleasePoolArtifact.bytecode;
  const burnMintBytecode = BurnMintPoolArtifact.bytecode;

  // Get token bytecodes for CREATE2 prediction
  const SharesFactory = await sourceConnection.ethers.getContractFactory(
    "Shares"
  );
  const SHAFactory = await sourceConnection.ethers.getContractFactory(
    "SharesUnderAgreement"
  );
  const BSHAFactory = await sourceConnection.ethers.getContractFactory(
    "BridgedSharesUnderAgreement"
  );

  // // Factories
  // if possible are collected from tasks/deployment/const/factories
  let sourceFactory: string =
    FACTORIES_STORAGE[sourceNetworkName as keyof typeof FACTORIES_STORAGE];
  if (!sourceFactory) {
    // no source factory, so we deploy it
    console.log(`\n\nDeploying Source Factory on ${sourceNetworkName}...`);
    const { FactorySource } = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/factory/SourceFactoryModule.ts")
      ).default,
      {
        deploymentId: `factory-source-${sourceNetworkName}`,
        displayUi: true,
      }
    );
    sourceFactory = await FactorySource.getAddress();
    console.log(`\tDeployed Factory Source at ${sourceFactory}`);
  }

  console.log(`\n\nDeploying Destination Factories on missing networks...`);
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

  for (const net of missingNetworks) {
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
        displayUi: true,
      }
    );
    const destinationFactoryAddress = await FactoryDestination.getAddress();
    console.log(
      `\tDeployed Factory Destination at ${destinationFactoryAddress}`
    );
    console.log(
      `Consider adding factory: ${destinationFactoryAddress} to network: ${net} within FACTORIES_STORAGE object`
    );

    tmpDestinationFactories[net] = destinationFactoryAddress;
  }
  const destinationFactories = tmpDestinationFactories as {
    [key in CCIPNetwork]: string;
  };
  console.log("All Destination factories have been deployed");

  // // Predict destination token and pool addresses for source chain config
  // The source chain's remoteTokenPools needs to reference destination pool/token.
  // We predict them here using CREATE2 since we know the factory addresses and bytecodes.
  const encode = (types: string[], values: any[]) =>
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(types, values);

  const tmpPredictedBshaAddresses: {
    [key in CCIPNetwork]?: string;
  } = {};
  const tmpPredictedBurnMintPoolAddresses: {
    [key in CCIPNetwork]?: string;
  } = {};

  for (const net of destinationNetworkNames) {
    const bshaParams = BSHA_PARAMETERS[net]!;

    // BSHA predicted address (deployed by FactoryDestination)
    const bshaInitCode = sourceConnection.ethers.concat([
      BSHAFactory.bytecode,
      encode(
        ["string", "string", "string", "address"],
        [
          bshaParams.bSYMBOL,
          bshaParams.bNAME,
          bshaParams.bTERMS,
          destinationFactories[net],
        ]
      ),
    ]);
    const predictedBshaAddr = sourceConnection.ethers.getCreate2Address(
      destinationFactories[net],
      SALT,
      sourceConnection.ethers.keccak256(bshaInitCode)
    );
    tmpPredictedBshaAddresses[net] = predictedBshaAddr;

    // BurnMint pool predicted address (deployed by TokenPoolFactory)
    // TokenPoolFactory modifies salt: salt = keccak256(abi.encodePacked(salt, msg.sender))
    const burnMintSalt = sourceConnection.ethers.keccak256(
      sourceConnection.ethers.solidityPacked(
        ["bytes32", "address"],
        [SALT, destinationFactories[net]]
      )
    );
    const burnMintPoolInitCode = sourceConnection.ethers.concat([
      burnMintBytecode,
      encode(
        ["address", "uint8", "address[]", "address", "address"],
        [
          predictedBshaAddr,
          0,
          [],
          CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].rmnProxy,
          CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].router,
        ]
      ),
    ]);
    const predictedBurnMintPoolAddr = sourceConnection.ethers.getCreate2Address(
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].tokenPoolFactory,
      burnMintSalt,
      sourceConnection.ethers.keccak256(burnMintPoolInitCode)
    );
    tmpPredictedBurnMintPoolAddresses[net] = predictedBurnMintPoolAddr;
  }

  const predictedBshaAddresses = tmpPredictedBshaAddresses as {
    [key in CCIPNetwork]: string;
  };
  const predictedBurnMintPoolAddresses = tmpPredictedBurnMintPoolAddresses as {
    [key in CCIPNetwork]: string;
  };

  // // Source chain data
  const sourceChainlinkAddresses: SourceChainlinkAddresses = {
    tokenPoolFactory:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].tokenPoolFactory,
    tokenAdminRegistry:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .tokenAdminRegistry,
    registryModuleOwner:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .registryModuleOwner,
    rmnProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].rmnProxy,
    router: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
  };

  let sharesUnderAgreement = _taskArguments.sha ?? ethers.ZeroAddress;
  if (sharesUnderAgreement != ethers.ZeroAddress) {
    console.log(
      `\n\nMake sure that for SharesUnderAgreement: ${sharesUnderAgreement} the owner is the destination factory`
    );
  }

  const sharesDeploymentData: SharesDeploymentData = {
    candidate: ethers.ZeroAddress,
    bytecode: SharesFactory.bytecode,
    symbol: SYMBOL,
    name: NAME,
    terms: TERMS,
  };
  const sharesUnderAgreementDeploymentData: SharesUnderAgreementDeploymentData =
    {
      candidate: ethers.ZeroAddress,
      bytecode: SHAFactory.bytecode,
      terms: TERMS,
    };

  // Build remote token pools for source chain (destination pools)
  const sourceRemoteTokenPools: RemoteTokenPoolInfo[] = [];
  for (let net of destinationNetworkNames) {
    sourceRemoteTokenPools.push({
      remoteChainSelector:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].remoteChainSelector,

      // We predict destination pool address and pass it
      remotePoolAddress: encode(
        ["address"],
        [predictedBurnMintPoolAddresses[net]]
      ), // bytes
      remotePoolInitCode: "0x", // bytes for CREATE2 prediction not needed

      remoteChainConfig: {
        remotePoolFactory: destinationFactories[net],
        remoteRouter: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].router,
        remoteRMNProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].rmnProxy,
        remoteTokenDecimals: 0, // can be hardcoded to zero
      },

      // remote pool type
      poolType: PoolType.BURN_MINT,

      // We predict destination token address and pass it
      remoteTokenAddress: encode(["address"], [predictedBshaAddresses[net]]), // bytes
      remoteTokenInitCode: "0x", // bytes for CREATE2 prediction not needed

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
    chainlinkAddresses: sourceChainlinkAddresses,
    lockReleaseTokenPoolBytecode: lockReleaseBytecode,
    remoteTokenPools: sourceRemoteTokenPools,
    futureOwner: ethers.ZeroAddress,
    salt: SALT,
  };

  // // Deploy on source chain
  console.log(
    `\n\nDeploying Shares, SHA and LockReleasePool on ${sourceNetworkName}...`
  );
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

  // // Destination chain deployment
  // Now we know the actual source pool address, pass it to each destination

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

    const destinationChainlinkAddresses: DestinationChainlinkAddresses = {
      tokenPoolFactory:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].tokenPoolFactory,
      tokenAdminRegistry:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].tokenAdminRegistry,
      registryModuleOwner:
        CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].registryModuleOwner,
      rmnProxy: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].rmnProxy,
      router: CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[net].router,
    };

    const bridgedSharesUnderAgreementDeploymentData: BridgedSharesUnderAgreementDeploymentData =
      {
        candidate: ethers.ZeroAddress,
        bytecode: BSHAFactory.bytecode,
        symbol: BSHA_PARAMETERS[net]!.bSYMBOL,
        name: BSHA_PARAMETERS[net]!.bNAME,
        terms: BSHA_PARAMETERS[net]!.bTERMS,
      };

    // Remote token pools for destination chain (source chain pools)
    const destinationRemoteTokenPools: RemoteTokenPoolInfo[] = [
      {
        remoteChainSelector:
          CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
            .remoteChainSelector,

        // we know the actual source pool address
        remotePoolAddress: lsbBytesLockReleaseTokenPool, // bytes
        remotePoolInitCode: "0x", // bytes - already deployed

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

        // we know the actual source token address
        remoteTokenAddress: lsbBytesSharesUnderAgreement, // bytes
        remoteTokenInitCode: "0x", // bytes - already deployed

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
      chainlinkAddresses: destinationChainlinkAddresses,
      burnMintTokenPoolBytecode: burnMintBytecode,
      remoteTokenPools: destinationRemoteTokenPools,
      futureOwner: ethers.ZeroAddress,
      salt: SALT,
    };

    console.log(`\n\nDeploying bSHA and BurnMintPool on ${net}...`);
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

  // // Accept ownerships in source
  // LockReleaseTokenPool ownership was transferred by FactorySource -> CCIPService -> futureOwner
  // TokenAdminRegistry admin role was transferred by FactorySource -> CCIPService -> futureOwner
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

  // // Accept ownerships in destination
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
