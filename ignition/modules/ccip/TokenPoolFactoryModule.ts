/**
 * Single Module to deploy a TokenPool within the CCIP Infrastructure through TokenPoolFactory
 *
 * Does not feel correct to not be able to do so within a single ignition module, but the
 * inability to receiver and wait for a function to be executed makes it impossible for
 * further deployment that rely on it to happen.
 *
 * Definitely an issue, and later to be implemented feature, that should be raise to the Hardhat
 * team.
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import { CREATE2_SALT } from "./lib/config.ts";

import { PoolType, RemoteTokenPoolInfo } from "./lib/types.ts";

export default buildModule("TokenPoolFactoryModule", (m) => {
  // previous deployments
  const sharesUnderAgreement = m.getParameter<number>("sharesUnderAgreement");
  const decimals = m.getParameter<number>("decimals");
  const remoteTokenAddress = m.getParameter<string>("remoteTokenAddress");

  // source addresses
  const tokenPoolFactory = m.getParameter<string>("tokenPoolFactory");

  // destination addresses
  const destinationChainSelector = m.getParameter<bigint>(
    "destinationChainSelector"
  );
  const destinationPoolFactory = m.getParameter<string>(
    "destinationPoolFactory"
  );
  const destinationRouter = m.getParameter<string>("destinationRouter");
  const destinationRMNProxy = m.getParameter<string>("destinationRMNProxy");

  // bytecode
  const lockReleaseTokenPoolBytecode = m.getParameter(
    "lockReleaseTokenPoolBytecode"
  );

  const burnMintTokenPoolBytecode = m.getParameter<string>(
    "burnMintTokenPoolBytecode"
  );

  // after:
  //  - Deploy Token (Shares then SharesUnderAgreement)
  // Deply Pool
  // deploy token pool with existing token at POOL_ADDRESS: LockReleaseTokenPool
  // https://sepolia.etherscan.io/tx/0x48c5f239160aa56a8406ae0713420eef5e3de4a5bd2ee02d3f03bb7183379130
  // call Function:
  // function deployTokenPoolWithExistingToken(
  //   address token,
  //   uint8 localTokenDecimals,
  //   RemoteTokenPoolInfo[] calldata remoteTokenPools,
  //   bytes calldata tokenPoolInitCode,
  //   bytes32 salt,
  //   PoolType poolType
  // ) external returns (address poolAddress)
  // Returns token pool created
  const TokenPoolFactory = m.contractAt("TokenPoolFactory", tokenPoolFactory);

  const remoteTokenPoolInfo: RemoteTokenPoolInfo = {
    remoteChainSelector: destinationChainSelector,

    // remote pool
    remotePoolAddress: "0x", // contract will guess it
    remotePoolInitCode: burnMintTokenPoolBytecode,

    remoteChainConfig: {
      remotePoolFactory: destinationPoolFactory,
      remoteRouter: destinationRouter,
      remoteRMNProxy: destinationRMNProxy,
      remoteTokenDecimals: decimals,
    },

    // remote is burn/mint
    poolType: PoolType.BURN_MINT,

    // remote token
    remoteTokenAddress: remoteTokenAddress,
    remoteTokenInitCode: "0x", // no need to guess it

    // disabled
    rateLimiterConfig: {
      isEnabled: false,
      capacity: 0n,
      rate: 0n,
    },
  };

  // call deploying function
  m.call(TokenPoolFactory, "deployTokenPoolWithExistingToken", [
    sharesUnderAgreement,
    decimals,
    [remoteTokenPoolInfo],
    lockReleaseTokenPoolBytecode,
    CREATE2_SALT,
    // PoolType.LOCK_RELEASE,
  ]);

  return {};
});
