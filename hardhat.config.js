require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-deploy");
require("@nomiclabs/hardhat-truffle5");
require("./tasks");

function getMnemonic(networkName) {
  if (networkName) {
    const mnemonic = process.env['MNEMONIC_' + networkName.toUpperCase()];
    if (mnemonic && mnemonic !== '') {
      return mnemonic;
    }
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic || mnemonic === '') {
    return 'test test test test test test test test test test test junk';
  }
  return mnemonic;
}

function accounts(networkName){
  return {mnemonic: getMnemonic(networkName)};
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("mainnet"),
      gasPrice: 120 * 1000000000,
      chainId: 1,
    },
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ["local"],
      
    },
    /*hardhat: {
      initialBaseFeePerGas: 0,
      accounts: accounts(),
      forking: {
        enabled: process.env.FORKING === "true",
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 13191833,
      },
      live: false,
      saveDeployments: true,
      chainId: 31337, // the default chain ID used by Hardhat Network's blockchain
      tags: ["test", "local"]
    },*/
    hardhat: {
      initialBaseFeePerGas: 0,
      accounts: accounts(),
      forking: {
        enabled: process.env.FORKING === "true",
        url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_OPTIMISM}`,
        blockNumber: 4180042, //optimism transaction index
      },
      live: false,
      saveDeployments: true,
      chainId: 31337, // the default chain ID used by Hardhat Network's blockchain
      tags: ["test", "local"],
      deploy: ['deploy_optimism']
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("ropsten"),
      chainId: 3,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2,
      gas: 3000000
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("rinkeby"),
      chainId: 4,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("goerli"),
      chainId: 5,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("kovan"),
      chainId: 42,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 20000000000,
      gasMultiplier: 2,
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: accounts("arbitrum"),
      chainId: 42161,
      live: true,
      saveDeployments: true,
      blockGasLimit: 700000,
    },
    rinkebyArbitrum: {
      url: "https://rinkeby.arbitrum.io/rpc",
      gasPrice: 0,
      accounts: accounts("rinkebyArbitrum"),
      companionNetworks: {
        l1: "rinkeby",
      },
    },
    localArbitrum: {
      url: "http://localhost:8547",
      gasPrice: 0,
      accounts: accounts(),
      companionNetworks: {
        l1: "localArbitrumL1",
      },
    },
    localArbitrumL1: {
      url: "http://localhost:7545",
      gasPrice: 0,
      accounts: accounts(),
      companionNetworks: {
        l2: "localArbitrum",
      },
    },
    localOptimism: {
      url: 'http://localhost:8545',
      accounts: accounts(),
      // forking: {
      //   enabled: false, // process.env.FORKING === "true",
      //   url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_OPTIMISM}`,
      //   blockNumber: 654,
      // },
      // companionNetworks: {
      //   l1: "localOptimismL1"
      // },
      deploy: ['deploy_optimism']
    },
    localOptimismL1: {
      url: 'http://localhost:9545',
      accounts: accounts(),
      companionNetworks: {
        l2: "localOptimism"
      },
      deploy: ['deploy_optimism']
    },
    kovanOptimism: {
      url: 'https://kovan.optimism.io',
      accounts: accounts("kovan"),
      chainId: 69,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      deploy: ['deploy_optimism']
    },
    optimism: {
        //url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_OPTIMISM}`,
        url: "https://mainnet.optimism.io",
        accounts: accounts("mainnet"),
        //chainId: 10,
        live: true,
        saveDeployments: true,
        deploy: ['deploy_optimism']
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: 1,
      1: process.env.MULTISIG_DEPLOY, // to multisigwallet
      10: process.env.MULTISIG_DEPLOY, // optimism
      3: process.env.MULTISIG_DEPLOY, // ropsten
      4: process.env.MULTISIG_DEPLOY, // rinkeby
      5: process.env.MULTISIG_DEPLOY, // goerli
      42: process.env.MULTISIG_DEPLOY, // kovan
      69: process.env.MULTISIG_DEPLOY, // optimism kovan
      42161: process.env.MULTISIG_DEPLOY // arb1
    },
    dev: {
      // Default to 1
      default: 1,
      // dev address mainnet
      // 1: "",
    },
    multiSigDefaultOwner: {
      default: 0,
      1: process.env.MULTISIG_DEFAULT,
      10: process.env.MULTISIG_DEFAULT,
      3: process.env.MULTISIG_DEFAULT,
      4: process.env.MULTISIG_DEFAULT,
      5: process.env.MULTISIG_DEFAULT,
      42: process.env.MULTISIG_DEFAULT,
      69: process.env.MULTISIG_DEFAULT,
      42161: process.env.MULTISIG_DEFAULT,
    }
  },
  gasReporter: {
    enabled:
      process.env.REPORT_GAS !== undefined ? process.env.REPORT_GAS : true,
    currency: "CHF",
    // url: "http://192.168.0.100:8546",
    // excludeContracts: ["contracts/mocks/", "contracts/libraries/"],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000
  }
};
