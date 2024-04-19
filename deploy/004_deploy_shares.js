const Confirm = require('prompt-confirm');
const config = require("../scripts/deploy_config_polygon.js");
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");
  const permit2Hub = await deployments.get("Permit2Hub");

  const symbol = "SHR";
  const name = "Test Deployment1 Shares";
  const terms = "test.ch/terms";
  const totalShares = 10000000;
  
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Shares")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("owner: %s", owner); // don't forget to set it in the hardhat config
    console.log("permit2Hub: %s", permit2Hub.address); 

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();

  const { address } = await deploy("Shares", {
    contract: "Shares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      owner,
      recoveryHub.address,
      permit2Hub.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["Shares"];
module.exports.dependencies = ["RecoveryHub", "Permit2Hub"];

