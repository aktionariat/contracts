const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();
    
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Brokerbot Registry")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", deployer);  // don't forget to set it in hardhat.config.js as the multsig account

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await getGasPrice();

  const { address } = await deploy("BrokerbotRegistry", {
    contract: "BrokerbotRegistry",
    from: deployer,
    args: [
      deployer],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["BrokerbotRegistry"];