const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const brokerbotRegistry = await deployments.get("BrokerbotRegistry");
    
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Token Registry")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account
    console.log("brokerbot registry: %s", brokerbotRegistry.address);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();
  
  const { address } = await deploy("TokenRegistry", {
    contract: "TokenRegistry",
    from: deployer,
    args: [
      owner,
      brokerbotRegistry.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["TokenRegistry"];
module.exports.dependencies = ["BrokerbotRegistry"]