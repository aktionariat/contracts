require("dotenv").config();

require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("hardhat-change-network");

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

function getForkUrl() {
  switch (process.env.FORK_NETWORK) {
    case "polygon":
      return `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_POLYGON}`;
    default:
      if (process.env.LOCAL) {
        return `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`;
      } else {
        return `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
      }
  }
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
    hardhat: {
      initialBaseFeePerGas: 0,
      accounts: accounts(),
      forking: {
        //enabled: process.env.FORKING === "true",
        url: getForkUrl(),
        blockNumber: 50340881,
      },
      live: false,
      saveDeployments: true,
      //chainId: 31337, // the default chain ID used by Hardhat Network's blockchain
      //chainId: 1, // 1 for forking mainnet test
      chainId: 137,
      tags: ["test", "local"],
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
      //url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_GOERLI}`,
      accounts: accounts("goerli"),
      chainId: 5,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
      gas: 3000000
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_SEPOLIA}`,
      accounts: accounts("sepolia"),
      chainId: 11155111,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
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
    kovanOptimism: {
      url: 'https://kovan.optimism.io',
      accounts: accounts("optimism_kovan"),
      chainId: 69,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      deploy: ['deploy_optimism']
    },
    optimism: {
        //url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_OPTIMISM}`,
        url: "https://mainnet.optimism.io",
        accounts: accounts("optimism"),
        //chainId: 10,
        live: true,
        saveDeployments: true,
        deploy: ['deploy_optimism']
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_POLYGON}`,
      accounts: accounts("polygon"),
      chainId: 137,
      live: true,
      saveDeployments: true,
      deploy: ['deploy_polygon']
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_POLYGON}`,
      accounts: accounts("mumbai"),
      chainId: 80001,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2,
      gas: 3000000,
      deploy: ['deploy_polygon']
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
      137: 1,
      3: 1,
      4: 1,
      5: 1,
      11155111: 1,
      69: 1,
      80001: 1,
    },
    owner: {
      default: 1,
      //1: process.env.MULTISIG_DEPLOY, // mainnet
      10: process.env.MULTISIG_DEPLOY, // optimism
      //137: process.env.MULTISIG_DEPLOY, // polygon
      3: process.env.MULTISIG_DEPLOY, // ropsten
      4: process.env.MULTISIG_DEPLOY, // rinkeby
      5: process.env.MULTISIG_DEPLOY, // goerli
      11155111: process.env.MULTISIG_DEPLOY, // sepolia
      69: process.env.MULTISIG_DEPLOY, // optimism kovan
      42161: process.env.MULTISIG_DEPLOY, // arb1
      8001: process.env.MULTISIG_DEPLOY  // mumbai
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
      11155111: process.env.MULTISIG_DEFAULT,
      69: process.env.MULTISIG_DEFAULT,
      42161: process.env.MULTISIG_DEFAULT,
      80001: process.env.MULTISIG_DEFAULT,
      137: process.env.MULTISIG_DEFAULT
    },
    trustedForwarder: {
      default: process.env.TRUSTED_FORWARDER,
      1: process.env.TRUSTED_FORWARDER, // mainnet
      10: process.env.TRUSTED_FORWARDER, // op mainnet
    }
  },
  gasReporter: {
    enabled:
      process.env.REPORT_GAS !== undefined ? process.env.REPORT_GAS : true,
    currency: "CHF",
    // url: "http://192.168.0.100:8546",
    // excludeContracts: ["contracts/mocks/", "contracts/libraries/"],
  },
  verify: {
    etherscan: {
      apiKey: {
        mainnet: process.env.ETHERSCAN_API_KEY,
        ropsten: process.env.ETHERSCAN_API_KEY,
        rinkeby: process.env.ETHERSCAN_API_KEY,
        goerli: process.env.ETHERSCAN_API_KEY,
        sepolia: process.env.ETHERSCAN_API_KEY,
        // optimism
        optimism: process.env.OPTIMISM_ETHERSCAN_API_KEY,
        kovanOptimism: process.env.OPTIMISM_ETHERSCAN_API_KEY,
        // polygon
        polygon: process.env.POLYGONSCAN_API_KEY,
        polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      }
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.21",
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
