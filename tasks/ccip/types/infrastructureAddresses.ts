export type CCIPInfrastructureAddresses = {
  tokenAdminRegistry: string;
  registryModuleOwner: string;
  tokenPoolFactory: string;
  rmnProxy: string;
  router: string;
  remoteChainSelector: bigint;
};

export type BaseCCIPNetwork =
  | "fuji"
  | "sepolia"
  | "amoy"
  | "baseSepolia"
  | "optimismSepolia";

type Capitalize<T extends string> = T extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : T;
export type CCIPNetwork =
  | BaseCCIPNetwork
  | `hardhat${Capitalize<BaseCCIPNetwork>}`;

export type CCIPInfrastructureAddressesStorage = {
  [network in CCIPNetwork]: CCIPInfrastructureAddresses;
};
