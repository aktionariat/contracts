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
        version: "0.8.37",
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
        robinhood: {
            // Robinhood Chain mainnet (Arbitrum Orbit L2). Chain id 4663, https://docs.robinhood.com/chain/connecting
            type: "http",
            chainId: 4663,
            chainType: "generic",
            url: KEYS.alchemy.robinhood,
            accounts: {
                mnemonic: KEYS.mnemonics.robinhood
            }
        },
        sepolia: {
            type: "http",
            chainId: 11155111,
            chainType: "l1",
            url: KEYS.alchemy.sepolia,
            accounts: {
                mnemonic: KEYS.mnemonics.sepolia
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
        hardhatRobinhood: {
            type: "edr-simulated",
            chainId: 4663,
            chainType: "generic",
            forking: {
                url: KEYS.alchemy.robinhood,
                enabled: true
            },
            accounts: {
                mnemonic: KEYS.mnemonics.robinhood
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
    
    chainDescriptors: {
        8453: {
            // Hardhat ships name/explorers for Base but no hardfork history, which EDR needs to
            // execute on a Base fork (hardhatBase). Isthmus has been live since 2025-05-09; block 0
            // is fine because forks only execute blocks after the fork block.
            name: "Base",
            chainType: "op",
            hardforkHistory: {
                isthmus: { blockNumber: 0 }
            },
            blockExplorers: {
                etherscan: {
                    name: "Basescan",
                    url: "https://basescan.org"
                },
                blockscout: {
                    name: "Blockscout",
                    url: "https://base.blockscout.com",
                    apiUrl: "https://base.blockscout.com/api"
                }
            }
        },
        4663: {
            name: "Robinhood Chain",
            blockExplorers: {
                blockscout: {
                    name: "Blockscout",
                    url: "https://robinhoodchain.blockscout.com",
                    apiUrl: "https://robinhoodchain.blockscout.com/api"
                }
            }
        }
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