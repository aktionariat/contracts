import { CCIPInfrastructureAddressesStorage } from "../types/infrastructureAddresses.ts";

// map network -> CCIP Contract name -> address
export const CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE: CCIPInfrastructureAddressesStorage =
  {
    fuji: {
      // token manager uses old addresses for these
      tokenAdminRegistry: "0xA92053a4a3922084d992fD2835bdBa4caC6877e6",
      registryModuleOwner: "0xefa93f3312840683893DbdeB3d53359b2d948F50",
      tokenPoolFactory: "0x8E9066E66bF1B8A4eAF2344589De9ff82CE47C2d",
      rmnProxy: "0xAc8CFc3762a979628334a0E4C1026244498E821b",
      router: "0xF694E193200268f9a4868e4Aa017A0118C9a8177",
      remoteChainSelector: 14767482510784806043n,
    },
    sepolia: {
      tokenAdminRegistry: "0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82",
      registryModuleOwner: "0xa3c796d480638d7476792230da1E2ADa86e031b0",
      tokenPoolFactory: "0x2067C0444F9dc58cFB33B095279A28886562f169",
      rmnProxy: "0xba3f6251de62dED61Ff98590cB2fDf6871FbB991",
      router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
      remoteChainSelector: 16015286601757825753n,
    },
  };
