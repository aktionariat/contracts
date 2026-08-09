import type {
  ModuleParameterRuntimeValue,
  ModuleParameterType,
} from "@nomicfoundation/ignition-core";

import type { RemoteTokenPoolInfo } from "../../ccip/lib/types.ts";

type RuntimeValue<T> = T | ModuleParameterRuntimeValue<T & ModuleParameterType>;

export type ToRuntimeValue<T> = {
  [K in keyof T]: RuntimeValue<T[K]>;
};

// factories common
export type ChainlinkAddresses = {
  tokenAdminRegistry: string;
  registryModuleOwner: string;
  rmnProxy: string;
  router: string;
};

// source
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
  chainlink: ChainlinkAddresses;
  remoteTokenPools: RemoteTokenPoolInfo[];
};

export type SourceParamsRuntimeValue = ToRuntimeValue<SourceParams>;

export type SourceDeployment = {
  shares: string;
  sharesUnderAgreement: string;
  lockReleaseTokenPool: string;
};

// destination
export type BridgedSharesUnderAgreementDeploymentData = {
  candidate: string;
  symbol: string;
  name: string;
  terms: string;
};

export type DestinationParams = {
  bridgedSharesUnderAgreement: BridgedSharesUnderAgreementDeploymentData;
  chainlink: ChainlinkAddresses;
  remoteTokenPools: RemoteTokenPoolInfo[];
};

export type DestinationParamsRuntimeValue = ToRuntimeValue<DestinationParams>;

export type DestinationDeployment = {
  bridgedSharesUnderAgreement: string;
  brunMintTokenPool: string;
};
