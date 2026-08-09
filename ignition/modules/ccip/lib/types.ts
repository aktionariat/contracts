import type {
  ModuleParameterRuntimeValue,
  ModuleParameterType,
} from "@nomicfoundation/ignition-core";

type RuntimeValue<T extends ModuleParameterType> =
  | T
  | ModuleParameterRuntimeValue<T>;

export type ToRuntimeValue<T> =
  // Primitive/Enum values, wrap
  T extends string | number | bigint | boolean
    ? RuntimeValue<T>
    : // Arrays, recurse
    T extends (infer U)[]
    ? ToRuntimeValue<U>[]
    : // Objects/Structs, recurse
    T extends object
    ? { [K in keyof T]: ToRuntimeValue<T[K]> }
    : T;
export enum PoolType {
  BURN_MINT = 0,
  LOCK_RELEASE = 1,
}

export type RemoteChainConfig = {
  remotePoolFactory: string;
  remoteRouter: string;
  remoteRMNProxy: string;
  remoteTokenDecimals: number;
};

export type RemoteChainConfigRuntimeValue = ToRuntimeValue<RemoteChainConfig>;

export type RateLimiterConfig = {
  isEnabled: boolean;
  capacity: bigint;
  rate: bigint;
};

export type RateLimiterConfigRuntimeValue = ToRuntimeValue<RateLimiterConfig>;

export type RemoteTokenPoolInfo = {
  remoteChainSelector: bigint; // uint64

  remotePoolAddress: string; // bytes
  remotePoolInitCode: string; // bytes

  remoteChainConfig: RemoteChainConfig;

  poolType: PoolType;

  remoteTokenAddress: string; // bytes
  remoteTokenInitCode: string; // bytes

  rateLimiterConfig: RateLimiterConfig;
};

export type RemoteTokenPoolInfoRuntimeValue =
  ToRuntimeValue<RemoteTokenPoolInfo>;

export type ChainUpdateRuntimeValue = {
  remoteChainSelector: RuntimeValue<bigint>;
  remotePoolAddresses: RuntimeValue<string>[]; // Address of the remote pool, ABI encoded: bytez
  remoteTokenAddress: RuntimeValue<string>; // Address of the remote token, ABI encoded: bytes
  outboundRateLimiterConfig: RateLimiterConfigRuntimeValue; // Outbound rate limited config, meaning the rate limits for all of the onRamps for the given chain
  inboundRateLimiterConfig: RateLimiterConfigRuntimeValue; // Inbound rate limited config, meaning the rate limits for all of the offRamps for the given chain
};
