/**
 * Single Module to deploy a TokenPool within the CCIP Infrastructure through localTokenPoolFactory
 *
 * Does not feel correct to not be able to do so within a single ignition module, but the
 * inability to receiver and wait for a function to be executed makes it impossible for
 * further deployment that rely on it to happen.
 *
 * Definitely an issue, and later to be implemented feature, that should be raise to the Hardhat
 * team.
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import { PoolType, RemoteTokenPoolInfoRuntimeValue } from "./lib/types.ts";

export default buildModule("TokenPoolFactoryModule", (m) => {
  // salt
  const salt = m.getParameter<string>("salt");

  // previous deployments
  const localToken = m.getParameter<string>("localToken");
  const localDecimals = m.getParameter<number>("localDecimals");
  const remoteToken = m.getParameter<string>("remoteToken");
  const remoteDecimals = m.getParameter<number>("remoteDecimals");

  // pools
  const localPoolType = m.getParameter<PoolType>("localPoolType");
  const remoteTokenPool = m.getParameter<string>("remoteTokenPool");
  const remotePoolType = m.getParameter<PoolType>("remotePoolType");

  // source addresses
  const localTokenPoolFactory = m.getParameter<string>("localTokenPoolFactory");

  // destination addresses
  const remoteChainSelector = m.getParameter<bigint>("remoteChainSelector");
  const remotePoolFactory = m.getParameter<string>("remotePoolFactory");
  const remoteRouter = m.getParameter<string>("remoteRouter");
  const remoteRMNProxy = m.getParameter<string>("remoteRMNProxy");

  // bytecode
  const localTokenPoolBytecode = m.getParameter<string>(
    "localTokenPoolBytecode"
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
  const LocalTokenPoolFactory = m.contractAt(
    "ITokenPoolFactory",
    localTokenPoolFactory
  );

  const remoteTokenPoolInfo: RemoteTokenPoolInfoRuntimeValue = {
    // remote chain selector
    remoteChainSelector: remoteChainSelector,

    // remote pool address
    remotePoolAddress: remoteTokenPool,
    remotePoolInitCode: "0x", // no need to guess it

    remoteChainConfig: {
      remotePoolFactory: remotePoolFactory,
      remoteRouter: remoteRouter,
      remoteRMNProxy: remoteRMNProxy,
      remoteTokenDecimals: remoteDecimals,
    },

    // remote is burn/mint
    poolType: remotePoolType,

    // remote token address
    remoteTokenAddress: remoteToken,
    remoteTokenInitCode: "0x", // no need to guess it

    // disabled
    rateLimiterConfig: {
      isEnabled: false,
      capacity: 0n,
      rate: 0n,
    },
  };

  // call deploying function
  // v1.6.0
  // address token,
  // uint8 localTokenDecimals,
  // RemoteTokenPoolInfo[] calldata remoteTokenPools,
  // bytes calldata tokenPoolInitCode,
  // bytes32 salt,
  // PoolType poolType
  m.call(LocalTokenPoolFactory, "deployTokenPoolWithExistingToken", [
    localToken,
    localDecimals,
    [remoteTokenPoolInfo],
    localTokenPoolBytecode,
    salt,
    localPoolType,
  ]);
  return {};
});
