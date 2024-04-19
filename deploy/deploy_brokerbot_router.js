const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  let brokerbotRegistry
  if (network.name != "hardhat") {
    brokerbotRegistry = "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98"; //for production deployment
  } else {
    const brokerbotRegistryContract = await deployments.get('BrokerbotRegistry'); // for testing
    brokerbotRegistry = brokerbotRegistryContract.address;
  }
    
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Brokerbot Router")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("registry: %s", brokerbotRegistry);  // don't forget to set it in hardhat.config.js as the multsig account

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();

  const { address } = await deploy("BrokerbotRouter", {
    contract: "BrokerbotRouter",
    from: deployer,
    args: [
      brokerbotRegistry],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["BrokerbotRouter"];