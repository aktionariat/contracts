import type {
  ModuleParameterRuntimeValue,
  ModuleParameterType,
} from "@nomicfoundation/ignition-core";

import type { RemoteTokenPoolInfo } from "../../ccip/lib/types.ts";

type RuntimeValue<T> = T | ModuleParameterRuntimeValue<T & ModuleParameterType>;

export type ToRuntimeValue<T> = {
  [K in keyof T]: RuntimeValue<T[K]>;
};

// source
export type SourceChainlinkAddresses = {
  tokenPoolFactory: string;
  tokenAdminRegistry: string;
  registryModuleOwner: string;
  rmnProxy: string;
  router: string;
};

export type SharesDeploymentData = {
  candidate: string;
  bytecode: string;
  symbol: string;
  name: string;
  terms: string;
};

export type SharesUnderAgreementDeploymentData = {
  candidate: string;
  bytecode: string;
  terms: string;
};

export type SourceParams = {
  shares: SharesDeploymentData;
  sharesUnderAgreement: SharesUnderAgreementDeploymentData;
  chainlink: SourceChainlinkAddresses;
  lockReleaseTokenPoolBytecode: string;
  remoteTokenPools: RemoteTokenPoolInfo[];
};

export type SourceParamsRuntimeValue = ToRuntimeValue<SourceParams>;

export type SourceDeployment = {
  shares: string;
  sharesUnderAgreement: string;
  lockReleaseTokenPool: string;
};

// destination
export type DestinationChainlinkAddresses = {
  tokenPoolFactory: string;
  tokenAdminRegistry: string;
  registryModuleOwner: string;
  rmnProxy: string;
  router: string;
};

export type BridgedSharesUnderAgreementDeploymentData = {
  candidate: string;
  bytecode: string;
  symbol: string;
  name: string;
  terms: string;
};

export type DestinationParams = {
  bridgedSharesUnderAgreement: BridgedSharesUnderAgreementDeploymentData;
  chainlink: DestinationChainlinkAddresses;
  burnMintTokenPoolBytecode: string;
  remoteTokenPools: RemoteTokenPoolInfo[];
};

export type DestinationParamsRuntimeValue = ToRuntimeValue<DestinationParams>;

export type DestinationDeployment = {
  bridgedSharesUnderAgreement: string;
  burnMintTokenPool: string;
};
