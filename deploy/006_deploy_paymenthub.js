const Confirm = require('prompt-confirm');
const config = require("../scripts/deploy_config.js");
const nconf = require('nconf');
const { network } = require('hardhat');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  
  const priceFeedCHFUSD = "0x449d117117838fFA61263B61dA6301AA2a88B13A";  // ethereum mainnet
  const priceFeedETHUSD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ethereum mainnet
  const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  let forwarder = "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b";
  if(network.name == "hardhat") {
    forwarder = deployer;
  }

  let prompt;
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------");
    console.log("Deploy Paymenthub");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("chainlink chf usd: %s", priceFeedCHFUSD);
    console.log("chainlink eth usd: %s", priceFeedETHUSD);
    console.log("uniswap qouter: %s", uniswapQuoter);
    console.log("uniswap router: %s", uniswapRouter);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("PaymentHub", {
    contract: "PaymentHub",
    from: deployer,
    args: [
      forwarder,
      uniswapQuoter,
      uniswapRouter,
      priceFeedCHFUSD,
      priceFeedETHUSD
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHub"];