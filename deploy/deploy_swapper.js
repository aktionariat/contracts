const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  console.log(getConfigPath());

  const xchf = config.baseCurrencyAddress;
  const zchf = config.zchfAddress;
  const uniswapRouter = config.uniswapRouterAddress;    
  let chainid = (await ethers.provider.getNetwork()).chainId;
  console.log("ChainId: ", chainid);
  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Swapper")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("xchf: %s", xchf);
    console.log("zchf: ", zchf);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  let feeData = await ethers.provider.getFeeData();
  if (network.name == "polygon") {
    feeData = await getGasPrice();
  }

  const { address } = await deploy("Swapper", {
    contract: "Swapper",
    from: deployer,
    args: [
      uniswapRouter,
      xchf,
      zchf
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
  });
};

module.exports.tags = ["Swapper"];
