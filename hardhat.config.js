require("dotenv").config();

require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("hardhat-change-network");
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");

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
  if (process.env.LOCAL) {
    return `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`;
  } else {
    return `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
  }
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  zksolc: {
    version: "1.3.5",
    compilerSource: "binary",
    settings: {},
  },
  defaultNetwork: "zkTestnet",
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("mainnet"),
      //gasPrice: 120 * 1000000000,
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
        blockNumber: 13759520,
      },
      live: false,
      saveDeployments: true,
      //chainId: 31337, // the default chain ID used by Hardhat Network's blockchain
      chainId: 1, // 1 for forking mainnet test
      tags: ["test", "local"],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: accounts("goerli"),
      chainId: 5,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    zkTestnet: {
      url: "https://zksync2-testnet.zksync.dev", // URL of the zkSync network RPC
      //ethNetwork: "goerli", // Can also be the RPC URL of the Ethereum network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      ethNetwork: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`, // Can also be the RPC URL of the Ethereum network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
      zksync: true,
      accounts: accounts("zktestnet"),
      gasPerPubdata: "5000"
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      5: 1,
      280: 1,
    },
    owner: {
      default: 1,
      //1: process.env.MULTISIG_DEPLOY, // mainnet
      10: process.env.MULTISIG_DEPLOY, // optimism
      5: process.env.MULTISIG_DEPLOY, // goerli
      280: process.MULTISIG_DEPLOY, //zksync
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
      5: process.env.MULTISIG_DEFAULT,
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
        goerli: process.env.ETHERSCAN_API_KEY,
        // optimism
        optimism: process.env.OPTIMISM_ETHERSCAN_API_KEY,
        // polygon
        polygon: process.env.POLYGONSCAN_API_KEY,
        polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      }
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
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
