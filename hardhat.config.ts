import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-toolbox";
import KEYS from "./KEYS";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: KEYS.alchemy.mainnet
      }
    },
    mainnet: {
      chainId: 1,
      url: KEYS.alchemy.mainnet
    },
    optimism: {
      chainId: 10,
      url: KEYS.alchemy.optimism
    },
    polygon: {
      chainId: 137,
      url: KEYS.alchemy.polygon
    },
    base: {
      chainId: 8453,
      url: KEYS.alchemy.base
    },
  },
};

export default config;
