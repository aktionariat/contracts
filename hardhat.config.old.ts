import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-tracer";
import KEYS from "./KEYS";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: `prague`,
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: KEYS.alchemy.mainnet
      },
      accounts: {
        mnemonic: KEYS.mnemonics.mainnet
      }
    },
    mainnet: {
      chainId: 1,
      url: KEYS.alchemy.mainnet,
      accounts: {
        mnemonic: KEYS.mnemonics.mainnet
      }
    },
    optimism: {
      chainId: 10,
      url: KEYS.alchemy.optimism,
      accounts: {
        mnemonic: KEYS.mnemonics.optimism
      }
    },
    polygon: {
      chainId: 137,
      url: KEYS.alchemy.polygon,
      accounts: {
        mnemonic: KEYS.mnemonics.polygon
      }
    },
    base: {
      chainId: 8453,
      url: KEYS.alchemy.base
    },
  },
  ignition: {
    strategyConfig: {
      create2: {
        salt: "0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE000000000000000000000dae"
      },
    },
  },
  etherscan: {
    apiKey: {
      mainnet: KEYS.etherscan.mainnet,
      optimisticEthereum: KEYS.etherscan.optimism,
      polygon: KEYS.etherscan.polygon,
      base: KEYS.etherscan.base
    },
  }
};

export default config;
