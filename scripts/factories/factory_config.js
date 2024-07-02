const config = {
  factory: {
    mainnet: "", // mainent 
    optimism: "", // optimism
    goerli: "", // goerli
    sepolia: "", // sepolia 
    localhost: "0x0EE19dCE0D025BfcBAf05843BbaAb4D315D6F5d4"
  },
  token: {
    name: "Test Shares",
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
    price: "0.01",
    increment: "0.00001",
    baseCurrency: "0x02567e4b14b25549331fCEe2B56c647A8bAB16FD"
  },
  deployLogDir: "./deploy_log"
};

module.exports = {config};