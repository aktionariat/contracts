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

export type RemoteChainConfigSolidityParameter = {
  remotePoolFactory: string;
  remoteRouter: string;
  remoteRMNProxy: string;
  remoteTokenDecimals: number;
};

export type RemoteChainConfig = {
  remotePoolFactory: RuntimeValue<string>;
  remoteRouter: RuntimeValue<string>;
  remoteRMNProxy: RuntimeValue<string>;
  remoteTokenDecimals: RuntimeValue<number>;
};

export type RateLimiterConfigSolidityParameter = {
  isEnabled: boolean;
  capacity: bigint;
  rate: bigint;
};

export type RateLimiterConfig = {
  isEnabled: RuntimeValue<boolean>;
  capacity: RuntimeValue<bigint>;
  rate: RuntimeValue<bigint>;
};

export type RemoteTokenPoolInfoSolidityParameter = {
  remoteChainSelector: bigint; // uint64

  remotePoolAddress: string; // bytes
  remotePoolInitCode: string; // bytes

  remoteChainConfig: RemoteChainConfigSolidityParameter;

  poolType: PoolType;

  remoteTokenAddress: string; // bytes
  remoteTokenInitCode: string; // bytes

  rateLimiterConfig: RateLimiterConfigSolidityParameter;
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

export type ChainUpdate = {
  remoteChainSelector: RuntimeValue<bigint>;
  remotePoolAddresses: RuntimeValue<string>[]; // Address of the remote pool, ABI encoded: bytez
  remoteTokenAddress: RuntimeValue<string>; // Address of the remote token, ABI encoded: bytes
  outboundRateLimiterConfig: RateLimiterConfig; // Outbound rate limited config, meaning the rate limits for all of the onRamps for the given chain
  inboundRateLimiterConfig: RateLimiterConfig; // Inbound rate limited config, meaning the rate limits for all of the offRamps for the given chain
};

// // Source Chain Factory Types
export type ChainlinkAddresses = {
  tokenAdminRegistry: string;
  registryModuleOwner: string;
  tokenPoolFactory: string;
};

export type SharesUnderAgreementDeploymentData = {
  candidate: string;
  contractBytecode: string;
  terms: string;
};

export type DeploymentData = {
  candidate: string;
  contractBytecode: string;
  constructorArgumentsBytecode: string;
};

export type SourceParams = {
  shares: RuntimeValue<DeploymentData>;
  sharesUnderAgreement: RuntimeValue<SharesUnderAgreementDeploymentData>;
  chainlink: RuntimeValue<ChainlinkAddresses>;
  lockReleaseTokenPoolBytecode: RuntimeValue<string>;
  remoteTokenPools: RuntimeValue<RemoteTokenPoolInfoSolidityParameter[]>;
  salt: RuntimeValue<string>;
};

// // Destination Chain Factory Types
export type BridgedSharesUnderAgreementDeploymentData = {
  candidate: string;
  contractBytecode: string;

  // constructor arguments
  symbol: string;
  name: string;
  terms: string;
};

export type DestinationParams = {
  bridgedSharesUnderAgreement: RuntimeValue<BridgedSharesUnderAgreementDeploymentData>;
  chainlink: RuntimeValue<ChainlinkAddresses>;
  burnMintTokenPoolBytecode: RuntimeValue<string>;
  remoteTokenPools: RuntimeValue<RemoteTokenPoolInfoSolidityParameter[]>;
  salt: RuntimeValue<string>;
};
