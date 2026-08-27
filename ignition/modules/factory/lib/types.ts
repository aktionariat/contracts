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
  registryModuleOwner: string;
  tokenAdminRegistry: string;
  rmnProxy: string;
  router: string;
};

export type SharesDeploymentData = {
  candidate: string;
  symbol: string;
  name: string;
  terms: string;
};

export type SharesUnderAgreementDeploymentData = {
  candidate: string;
  terms: string;
};

export type SourceParams = {
  shares: SharesDeploymentData;
  sharesUnderAgreement: SharesUnderAgreementDeploymentData;
  remoteTokenPools: RemoteTokenPoolInfo[];
};

export type SourceParamsRuntimeValue = ToRuntimeValue<SourceParams>;

export type SourceDeployment = {
  shares: string;
  sharesUnderAgreement: string;
  lockReleaseTokenPool: string;
};

// logics source
export type LogicsSourceParams = {
  sharesBytecode: string;
  shaBytecode: string;
  lockReleaseTokenPoolBytecode: string;
  chainlinkAddresses: SourceChainlinkAddresses;
};

export type LogicsSourceParamsRuntimeValue = ToRuntimeValue<LogicsSourceParams>;

// destination
export type DestinationChainlinkAddresses = {
  tokenPoolFactory: string;
  registryModuleOwner: string;
  tokenAdminRegistry: string;
  rmnProxy: string;
  router: string;
};

export type BridgedSharesUnderAgreementDeploymentData = {
  candidate: string;
  symbol: string;
  name: string;
  terms: string;
};

export type DestinationParams = {
  bridgedSharesUnderAgreement: BridgedSharesUnderAgreementDeploymentData;
  remoteTokenPools: RemoteTokenPoolInfo[];
};

export type DestinationParamsRuntimeValue = ToRuntimeValue<DestinationParams>;

export type DestinationDeployment = {
  bridgedSharesUnderAgreement: string;
  burnMintTokenPool: string;
};

// logics destination
export type LogicsDestinationParams = {
  bridgedSHABytecode: string;
  burnMintTokenPoolBytecode: string;
  chainlinkAddresses: DestinationChainlinkAddresses;
};

export type LogicsDestinationParamsRuntimeValue =
  ToRuntimeValue<LogicsDestinationParams>;
