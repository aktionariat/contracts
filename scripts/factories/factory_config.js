const config = {
  factory: {
    mainnet: "", // mainent 
    optimism: "", // optimism
    goerli: "", // goerli
    sepolia: "", // sepolia 
    localhost: "0x0EE19dCE0D025BfcBAf05843BbaAb4D315D6F5d4"
  },
  token: {
    name: "Test Shares AG",
    symbol: "TST111",
    terms: "www.test.ch",
    allowlist: false,
    draggable: true,
    numberOfShares: 1000000,
    quorumDrag: 7500,
    quorumMigration: 7500,
    votePeriod: 60*60*24*90
  },
  brokerbot: {
    price: "6.24455",
    increment: "0.000035",
    baseCurrency: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB" //zchf mainnet
  },
  registry: {
    mainnet: "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98",
    optimism: "",
    polygon: "0xb4dC570b6Aa16d431771c0b01cB78029E0bE559e"
  },
  deployLogDir: "./deploy_log"
};

module.exports = {config};