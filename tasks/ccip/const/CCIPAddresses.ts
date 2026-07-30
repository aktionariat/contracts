import { CCIPInfrastructureAddressesStorage } from "../types/infrastructureAddresses.ts";

// do not define ahrdhat networks such as hardhatFuji, they are computed automatically
// map network -> CCIP Contract name -> address
//@ts-expect-error
const CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE_NETWORKS: CCIPInfrastructureAddressesStorage =
  {
    fuji: {
      tokenAdminRegistry: "0xA92053a4a3922084d992fD2835bdBa4caC6877e6",

      // chainlink devhub address:
      registryModuleOwner: "0xefa93f3312840683893DbdeB3d53359b2d948F50",
      // token manager address:
      // registryModuleOwner: "0x97300785aF1edE1343DB6d90706A35CF14aA3d81",

      // chainlink devhub address:
      tokenPoolFactory: "0x8E9066E66bF1B8A4eAF2344589De9ff82CE47C2d",
      // token manager address:
      // tokenPoolFactory: "0x9fCd83bC7F67ADa1fB51a4caBEa333c72B641bd1",

      rmnProxy: "0xAc8CFc3762a979628334a0E4C1026244498E821b",
      router: "0xF694E193200268f9a4868e4Aa017A0118C9a8177",
      remoteChainSelector: 14767482510784806043n,
    },
    amoy: {
      tokenAdminRegistry: "0x1e73f6842d7afDD78957ac143d1f315404Dd9e5B",
      registryModuleOwner: "0xAF2356327c6BBd644A273271B6cA301B49787970",
      tokenPoolFactory: "0xaDFb7b14a3eB752b392b69a68bfDD21eAF27466E",
      rmnProxy: "0x7c1e545A40750Ee8761282382D51E017BAC68CBB",
      router: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2",
      remoteChainSelector: 16281711391670634445n,
    },
    sepolia: {
      tokenAdminRegistry: "0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82",

      // chainlink devhub address:
      registryModuleOwner: "0xa3c796d480638d7476792230da1E2ADa86e031b0",
      // token manager address:
      // registryModuleOwner: "0x62e731218d0D47305aba2BE3751E7EE9E5520790",

      // chainlink devhub address:
      tokenPoolFactory: "0x2067C0444F9dc58cFB33B095279A28886562f169",
      // token manager address:
      // tokenPoolFactory: "0xBCf47E9195A225813A629BB7580eDF338c2d8202",

      rmnProxy: "0xba3f6251de62dED61Ff98590cB2fDf6871FbB991",
      router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
      remoteChainSelector: 16015286601757825753n,
    },
    baseSepolia: {
      tokenAdminRegistry: "0x736D0bBb318c1B27Ff686cd19804094E66250e17",
      registryModuleOwner: "0x176ae8C6C11DD2c031B924CE1A0A43188035f3f6",
      tokenPoolFactory: "0x29014dCC16CD6543F5c09623FD9c325902076caD",
      rmnProxy: "0x99360767a4705f68CcCb9533195B761648d6d807",
      router: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93",
      remoteChainSelector: 10344971235874465080n,
    },
  };

const hardhatNetworks = Object.fromEntries(
  Object.entries(CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE_NETWORKS).map(
    ([network, addresses]) => [
      `hardhat${network[0].toUpperCase()}${network.slice(1)}`,
      addresses,
    ]
  )
);

const CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE = {
  ...CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE_NETWORKS,
  ...hardhatNetworks,
};

export default CCIP_INFRASTRUCTURE_ADDRESSES_STORAGE;
