import type { HardhatUserConfig } from "hardhat/config";

import HardhatIgnitionEthersPlugin from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatNetworkHelpersPlugin from "@nomicfoundation/hardhat-network-helpers";

import KEYS from "./KEYS.ts";

import {
  // CCIP tasks
  allowTokenPoolOnBridgedSHATask,
  bridgeTokensTask,
  deployCCIPContractsInfrastructureTask,
  estimateCCIPDeploymentGasTask,
  addDestinationChainTask,

  // Shares task
  mintWrapSharesTask,
  removeDestinationChainPoolTask,
  resetDestinationChainTask,
  haltBridgeTask,
  enableBridgeTask,
} from "./tasks/index.ts";

const config: HardhatUserConfig = {
  plugins: [
    HardhatIgnitionEthersPlugin,
    hardhatToolboxMochaEthers,
    hardhatVerify,
    hardhatNetworkHelpersPlugin,
  ],

  tasks: [
    allowTokenPoolOnBridgedSHATask,
    bridgeTokensTask,
    deployCCIPContractsInfrastructureTask,
    estimateCCIPDeploymentGasTask,
    addDestinationChainTask,
    removeDestinationChainPoolTask,
    resetDestinationChainTask,
    haltBridgeTask,
    enableBridgeTask,
    mintWrapSharesTask,
  ],

  solidity: {
    version: "0.8.34",

    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: `prague`,
    },

    // explicit list of files to compile
    npmFilesToBuild: [
      // local
      "@chainlink/local/src/ccip/CCIPLocalSimulator.sol",
      "@chainlink/local/src/vendor/chainlink-ccip/test/mocks/MockRouter.sol",

      // contracts
      "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol",

      // contracts-ccip
      "@chainlink/contracts-ccip/contracts/pools/LockReleaseTokenPool.sol",
      "@chainlink/contracts-ccip/contracts/pools/BurnMintTokenPool.sol",
      "@chainlink/contracts-ccip/contracts/pools/TokenPool.sol",

      "@chainlink/contracts-ccip/contracts/Router.sol",
      "@chainlink/contracts-ccip/contracts/interfaces/IRouter.sol",
      "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol",

      "@chainlink/contracts-ccip/contracts/offRamp/OffRamp.sol",
      "@chainlink/contracts-ccip/contracts/onRamp/OnRamp.sol",

      // ITokenPoolFactory that you find in contracts/multichain/ccip
      // differs from package signatures and is the correct onchain
      // representation
      "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol",

      "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenAdminRegistry.sol",

      "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/RegistryModuleOwnerCustom.sol",
    ],
  },

  networks: {
    // Real Networks
    mainnet: {
      type: "http",
      chainId: 1,
      chainType: "l1",
      url: KEYS.alchemy.mainnet,
      accounts: {
        mnemonic: KEYS.mnemonics.mainnet,
      },
    },
    sepolia: {
      type: "http",
      chainId: 11155111,
      chainType: "l1",
      url: KEYS.alchemy.sepolia,
      accounts: {
        mnemonic: KEYS.mnemonics.sepolia,
      },
    },
    optimism: {
      type: "http",
      chainId: 10,
      chainType: "op",
      url: KEYS.alchemy.optimism,
      accounts: {
        mnemonic: KEYS.mnemonics.optimism,
      },
    },
    polygon: {
      type: "http",
      chainId: 137,
      chainType: "generic",
      url: KEYS.alchemy.polygon,
      accounts: {
        mnemonic: KEYS.mnemonics.polygon,
      },
    },
    base: {
      type: "http",
      chainId: 8453,
      chainType: "op",
      url: KEYS.alchemy.base,
      accounts: {
        mnemonic: KEYS.mnemonics.base,
      },
    },
    baseSepolia: {
      type: "http",
      chainId: 84532,
      chainType: "l1",
      url: KEYS.alchemy.baseSepolia,
      accounts: {
        mnemonic: KEYS.mnemonics.baseSepolia,
      },
    },
    fuji: {
      type: "http",
      chainId: 43113,
      chainType: "l1",
      url: KEYS.alchemy.fuji,
      accounts: {
        mnemonic: KEYS.mnemonics.fuji,
      },
    },
    amoy: {
      type: "http",
      chainId: 80002,
      chainType: "l1",
      url: KEYS.alchemy.amoy,
      accounts: {
        mnemonic: KEYS.mnemonics.amoy,
      },
    },

    // Simulated Networks
    default: {
      type: "edr-simulated",
      chainId: 1,
      chainType: "l1",
      forking: {
        url: KEYS.alchemy.mainnet,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.mainnet,
      },
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainId: 1,
      chainType: "l1",
      forking: {
        url: KEYS.alchemy.mainnet,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.mainnet,
      },
    },
    hardhatSepolia: {
      type: "edr-simulated",
      chainId: 11155111,
      chainType: "l1",
      forking: {
        url: KEYS.alchemy.baseSepolia,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.baseSepolia,
      },
    },
    hardhatOptimism: {
      type: "edr-simulated",
      chainId: 10,
      chainType: "op",
      forking: {
        url: KEYS.alchemy.optimism,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.optimism,
      },
    },
    hardhatPolygon: {
      type: "edr-simulated",
      chainId: 137,
      chainType: "generic",
      forking: {
        url: KEYS.alchemy.polygon,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.polygon,
      },
    },
    hardhatBase: {
      type: "edr-simulated",
      chainId: 8453,
      chainType: "op",
      forking: {
        url: KEYS.alchemy.base,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.base,
      },
    },
    hardhatBaseSepolia: {
      type: "edr-simulated",
      chainId: 84532,
      chainType: "l1",
      forking: {
        url: KEYS.alchemy.baseSepolia,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.baseSepolia,
      },
    },
    hardhatFuji: {
      type: "edr-simulated",
      chainId: 43113,
      chainType: "l1",
      forking: {
        url: KEYS.alchemy.fuji,
        enabled: true,
      },
      accounts: {
        mnemonic: KEYS.mnemonics.fuji,
      },
    },
    hardhatAmoy: {
      type: "http",
      chainId: 80002,
      chainType: "l1",
      url: KEYS.alchemy.amoy,
      accounts: {
        mnemonic: KEYS.mnemonics.amoy,
      },
    },
  },

  ignition: {
    strategyConfig: {
      create2: {
        salt: "0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE000000000000000000000dae",
      },
    },
  },

  verify: {
    // With Etherscan V2, a single API key works for multiple networks
    etherscan: {
      apiKey: KEYS.etherscan.mainnet,
    },
    blockscout: {
      enabled: true,
    },
  },
};

export default config;
