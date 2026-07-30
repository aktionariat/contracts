import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";

import { printAndReturnErrorResult } from "../utils/error.ts";

import {
  getBridgedSharesDeploymentName,
  getBridgedSharesSetpoolDeploymentName,
  getFactoryDeploymentName,
  getSettingsDeploymentName,
  getSharesDeploymentName,
  resetAllCCIPIgnitionDeploymentFolder,
} from "./lib/CCIPIgnitionDeployments.ts";

import { predictTokenPoolAddress } from "../../ignition/modules/ccip/lib/tokenPool.ts";

import type { CCIPNetwork } from "./types/infrastructureAddresses.ts";
import CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE from "./const/CCIPAddresses.ts";
import { CREATE2_SALT } from "../../ignition/modules/ccip/lib/config.ts";
import {
  Shares,
  SharesUnderAgreement,
} from "../../types/ethers-contracts/index.ts";
import { PoolType } from "../../ignition/modules/ccip/lib/types.ts";

import { prettyStringifyObject } from "../utils/json.ts";

export interface DeployCCIP_taskArguments {
  sha?: string;
  terms: string;
  name: string;
  symbol: string;
  source: string;
  destination: string;
  reset: boolean;
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

  if (_taskArguments.reset) {
    console.log(
      `\n\nResetting ignition deployments for source ${sourceNetworkName} and destination ${destinationNetworkName} network`
    );
    resetAllCCIPIgnitionDeploymentFolder(sourceNetworkName);
    resetAllCCIPIgnitionDeploymentFolder(destinationNetworkName);
  }

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

  // deploy SHA
  let Shares: Shares;
  let SharesUnderAgreement: SharesUnderAgreement;
  if (!_taskArguments.sha) {
    // sha not passed in we deploy it
    console.log(
      `\n\nDeploying Shares and SharesUnderAgreement on ${sourceNetworkName}...`
    );
    const sharesDeplyment = await sourceConnection.ignition.deploy(
      (
        await import("../../ignition/modules/shares/SHAModule.ts")
      ).default,
      {
        deploymentId: getSharesDeploymentName(sourceNetworkName),

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
      `Shares and SharesUnderAgreement deployed on ${sourceNetworkName}`
    );
  } else {
    console.log(
      `\n\nSharesUnderAgreement is already deployed. Checking if bridging infrastructure is also deployed...`
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
    console.log(`No infrastructure deployed.\nDeploying...`);
  }

  // TODO can possibly make the user the option send already deployed bsha address, and not deploy bsha
  // TODO multiple deployments if multiple chain are requested to be implemented
  // user passes list of chains, here we loop and collected per chain BridgedSharesUnderAgreement
  // then passed to factory
  // deploy bridged token to destination

  // TODO: check with dRPC support the problem and possible solution
  // I am not sure if the Avalanche Fuji endpoint does not support
  // eth_call with pending, or if it is a problem with the dRPC
  // node. Note that also alchemy endpoint has this problem.
  // Made an adjustment for now.
  // Solution:  We ovveride the provider request funciton by
  //            wrapping it, within the wrap we override any
  //            eth_call that uses "pending" and that is
  //            expected to land on fuji with "latest"
  const provider = destinationConnection.provider;
  const originalRequest = provider.request.bind(provider);
  provider.request = async (args: any) => {
    const rpcUrl = (provider as any)._url ?? (provider as any).url ?? "";

    const isFuji =
      rpcUrl.includes("avalanche-fuji") ||
      rpcUrl.includes("fuji") ||
      destinationNetworkName === "fuji" ||
      destinationNetworkName === "hardhatFuji";

    if (
      isFuji &&
      args.method === "eth_call" &&
      Array.isArray(args.params) &&
      args.params.length >= 2 &&
      args.params[1] === "pending"
    ) {
      console.log(
        "Replacing eth_call blockTag pending -> latest (Fuji workaround)"
      );

      args = {
        ...args,
        params: [...args.params],
      };

      args.params[1] = "latest";
    }

    try {
      return await originalRequest(args);
    } catch (err: any) {
      console.log("\nRPC Error");
      console.log("Method:", args.method);
      console.dir(err, { depth: null });

      console.log("Status:", err?.statusCode ?? err?.cause?.statusCode);
      console.log(
        "JSON-RPC error:",
        err?.body?.error ?? err?.cause?.body?.error
      );
      console.log("Raw body:", err?.body ?? err?.cause?.body);

      throw err;
    }
  };

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

  // load Artifacts
  console.log(
    `\n\nLoading LockReleaseTokenPool and BurnMintTokenPool artifacts...`
  );
  const lockReleaseTokenPoolArtifact = await _hre.artifacts.readArtifact(
    "LockReleaseTokenPool"
  );
  const sourcePoolType = PoolType.LOCK_RELEASE;
  const burnMintTokenPoolArtifact = await _hre.artifacts.readArtifact(
    "BurnMintTokenPool"
  );
  const destinationPoolType = PoolType.BURN_MINT;
  console.log(`Artifacts loaded`);

  // We predeterministically predict both
  // LockReleaseTokenPool and BurnMintTokenPool
  console.log(`\n\nPredicting LockReleaseTokenPool Address...`);
  const [signer] = await sourceConnection.ethers.getSigners();
  const sourceTokenPoolFactory =
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].tokenPoolFactory;
  const predictedLockReleaseTokenPoolAddress = predictTokenPoolAddress(
    sourceTokenPoolFactory,
    CREATE2_SALT,
    await signer.getAddress(),
    await SharesUnderAgreement.getAddress(),
    decimals,
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].rmnProxy,
    CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName].router,
    lockReleaseTokenPoolArtifact.bytecode,
    PoolType.LOCK_RELEASE
  );
  console.log(
    `Predicted LockReleaseTokenPool Address: ${predictedLockReleaseTokenPoolAddress}`
  );

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
  const sharesUnderAgreement: string = await SharesUnderAgreement.getAddress();
  const lsbBytesSharesUnderAgreement =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [sharesUnderAgreement]
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

  const lsbBytesPredictedLockReleaseTokenPoolAddress =
    sourceConnection.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [predictedLockReleaseTokenPoolAddress]
    );
  console.log(
    `lsbBytesPredictedLockReleaseTokenPoolAddress: ${lsbBytesPredictedLockReleaseTokenPoolAddress}`
  );

  // LockReleaseDeployment via TokenPoolFactory
  console.log(
    `\n\nExecuting TokenPoolFactoryModule for network ${sourceNetworkName}`
  );
  const SOURCE_FACTORY_PARAMETERS = {
    // salt
    salt: CREATE2_SALT,

    // tokens
    localToken: await SharesUnderAgreement.getAddress(),
    localDecimals: decimals,
    remoteToken: lsbBytesBridgedSharesUnderAgreement,
    remoteDecimals: decimals,

    // pools
    localPoolType: sourcePoolType,
    // in factory this has to be padded to bytes
    // should be set as bytes, and every time it is the case
    // we have to pad it
    remoteTokenPool: lsbBytesPredictedBurnMintTokenPoolAddress,
    remotePoolType: destinationPoolType,

    // Chainlink source addresses
    localTokenPoolFactory: sourceTokenPoolFactory,

    // Chainlink destination addresses
    remoteChainSelector:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
        .remoteChainSelector,
    remotePoolFactory:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName]
        .tokenPoolFactory,
    remoteRouter:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].router,
    remoteRMNProxy:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[destinationNetworkName].rmnProxy,

    // bytecodes
    localTokenPoolBytecode: lockReleaseTokenPoolArtifact.bytecode,
  };
  console.log(
    `Parameters:\n${prettyStringifyObject(SOURCE_FACTORY_PARAMETERS)}\n`
  );
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/TokenPoolFactoryModule.ts")
    ).default,
    {
      deploymentId: getFactoryDeploymentName(sourceNetworkName),

      parameters: {
        TokenPoolFactoryModule: SOURCE_FACTORY_PARAMETERS,
      },

      displayUi: true,
    }
  );

  // CCIP Settings transactions
  // for source network
  console.log(
    `\n\nExecuting ChainSettingsModule for network ${sourceNetworkName}`
  );
  const SOURCE_CHAIN_SETTINGS_PARAMETERS = {
    localToken: await SharesUnderAgreement.getAddress(),
    localTokenPool: predictedLockReleaseTokenPoolAddress,
    localRegistryModuleOwner:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .registryModuleOwner,
    localTokenAdminRegistry:
      CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE[sourceNetworkName]
        .tokenAdminRegistry,
  };
  console.log(
    `Parameters:\n${prettyStringifyObject(SOURCE_CHAIN_SETTINGS_PARAMETERS)}\n`
  );
  await sourceConnection.ignition.deploy(
    (
      await import("../../ignition/modules/ccip/ChainSettingsModule.ts")
    ).default,
    {
      deploymentId: getSettingsDeploymentName(sourceNetworkName),

      parameters: {
        ChainSettingsModule: SOURCE_CHAIN_SETTINGS_PARAMETERS,
      },

      displayUi: true,
    }
  );

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
    remoteTokenPool: lsbBytesPredictedLockReleaseTokenPoolAddress,
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
        DestinationSetPool: {
          localToken: bridgedSharesUnderAgreement,
          localTokenPool: predictedBurnMintTokenPoolAddress,
        },
      },

      displayUi: true,
    }
  );

  return successfulResult([]);
}
