const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, trustedForwarder } = await getNamedAccounts();

  const uniswapQuoter = config.uniswapQuoterAddress;
  const uniswapRouter = config.uniswapRouterAddress;

  let prompt;
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------");
    console.log("Deploy Paymenthub");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("uniswap qouter: %s", uniswapQuoter);
    console.log("uniswap router: %s", uniswapRouter);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();

  const { address } = await deploy("PaymentHub", {
    contract: "PaymentHub",
    from: deployer,
    args: [
      trustedForwarder,
      uniswapQuoter,
      uniswapRouter
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHub"];
