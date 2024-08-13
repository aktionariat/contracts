const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Draggable Factory")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner);

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

  const { address } = await deploy("DraggableTokenFactory", {
    contract: "DraggableTokenFactory",
    from: deployer,
    args: [
      owner
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    deterministicDeployment: true
  });
};

module.exports.tags = ["DraggableTokenFactory"];
