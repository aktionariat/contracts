import type { HardhatUserConfig } from "hardhat/config";
import HardhatIgnitionEthersPlugin from '@nomicfoundation/hardhat-ignition-ethers'
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import KEYS from "./KEYS.ts";

const config: HardhatUserConfig = {
    plugins: [
        HardhatIgnitionEthersPlugin,
        hardhatToolboxMochaEthers,
        hardhatVerify
    ],

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
    networks: {
        // Real Networks
        mainnet: {
            type: "http",
            chainId: 1,
            chainType: "l1",
            url: KEYS.alchemy.mainnet,
            accounts: {
                mnemonic: KEYS.mnemonics.mainnet
            }
        },
        optimism: {
            type: "http",
            chainId: 10,
            chainType: "op",
            url: KEYS.alchemy.optimism,
            accounts: {
                mnemonic: KEYS.mnemonics.optimism
            }
        },
        polygon: {
            type: "http",
            chainId: 137,
            chainType: "generic",
            url: KEYS.alchemy.polygon,
            accounts: {
                mnemonic: KEYS.mnemonics.polygon
            }
        },
        base: {
            type: "http",
            chainId: 8453,
            chainType: "op",
            url: KEYS.alchemy.base,
            accounts: {
                mnemonic: KEYS.mnemonics.base
            }
        },

        // Simulated Networks
        default: {
            type: "edr-simulated",
            chainId: 1,
            chainType: "l1",
            forking: {
                url: KEYS.alchemy.mainnet,
                enabled: true
            },
            accounts: {
                mnemonic: KEYS.mnemonics.mainnet
            }
        },
        hardhatMainnet: {
            type: "edr-simulated",
            chainId: 1,
            chainType: "l1",
            forking: {
                url: KEYS.alchemy.mainnet,
                enabled: true
            },
            accounts: {
                mnemonic: KEYS.mnemonics.mainnet
            }
        },
        hardhatOptimism: {
            type: "edr-simulated",
            chainId: 10,
            chainType: "op",
            forking: {
                url: KEYS.alchemy.optimism,
                enabled: true
            },
            accounts: {
                mnemonic: KEYS.mnemonics.optimism
            }
        },
        hardhatPolygon: {
            type: "edr-simulated",
            chainId: 137,
            chainType: "generic",
            forking: {
                url: KEYS.alchemy.polygon,
                enabled: true
            },
            accounts: {
                mnemonic: KEYS.mnemonics.polygon
            }
        },
        hardhatBase: {
            type: "edr-simulated",
            chainId: 8453,
            chainType: "op",
            forking: {
                url: KEYS.alchemy.base,
                enabled: true
            },
            accounts: {
                mnemonic: KEYS.mnemonics.base
            }
        },
    },

    ignition: {
        strategyConfig: {
            create2: {
                salt: "0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE000000000000000000000dae"
            },
        },
    },
    
    verify: {
        // With Etherscan V2, a single API key works for multiple networks
        etherscan: {
            apiKey: KEYS.etherscan.mainnet
        },
        blockscout: {
            enabled: true,
        },
    }
};

export default config;