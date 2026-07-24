export type CCIPInfrastructureAddresses = {
  tokenAdminRegistry: string;
  registryModuleOwner: string;
  tokenPoolFactory: string;
  rmnProxy: string;
  router: string;
  remoteChainSelector: bigint;
};

export type CCIPNetwork = "fuji" | "sepolia";

export type CCIPInfrastructureAddressesStorage = {
  [network in CCIPNetwork]: CCIPInfrastructureAddresses;
};
