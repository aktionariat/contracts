import type {
  ModuleParameterRuntimeValue,
  ModuleParameterType,
} from "@nomicfoundation/ignition-core";

type RuntimeValue<T extends ModuleParameterType> =
  | T
  | ModuleParameterRuntimeValue<T>;

export enum PoolType {
  BURN_MINT = 0,
  LOCK_RELEASE = 1,
}

export type RemoteChainConfig = {
  remotePoolFactory: RuntimeValue<string>;
  remoteRouter: RuntimeValue<string>;
  remoteRMNProxy: RuntimeValue<string>;
  remoteTokenDecimals: RuntimeValue<number>;
};

export type RateLimiterConfig = {
  isEnabled: RuntimeValue<boolean>;
  capacity: RuntimeValue<bigint>;
  rate: RuntimeValue<bigint>;
};

export type RemoteTokenPoolInfo = {
  remoteChainSelector: RuntimeValue<bigint>; // uint64

  remotePoolAddress: RuntimeValue<string>; // bytes
  remotePoolInitCode: RuntimeValue<string>; // bytes

  remoteChainConfig: RemoteChainConfig;

  poolType: RuntimeValue<PoolType>;

  remoteTokenAddress: RuntimeValue<string>; // bytes
  remoteTokenInitCode: RuntimeValue<string>; // bytes

  rateLimiterConfig: RateLimiterConfig;
};
