const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const draggableFactory = await deployments.get("DraggableTokenFactory");
  const allowlistDraggableFactory = await deployments.get("AllowlistDraggableFactory");

  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Token Factory")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner);
    console.log("draggable factory: %s", draggableFactory.address);
    console.log("allowlist draggable factory: %s", allowlistDraggableFactory.address);

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

  const { address } = await deploy("TokenFactory", {
    contract: "TokenFactory",
    from: deployer,
    args: [
      owner,
      draggableFactory.address,
      allowlistDraggableFactory.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    deterministicDeployment: true
  });
};

module.exports.tags = ["TokenFactory"];
module.exports.dependencies = ["DraggableTokenFactory", "AllowlistDraggableFactory"];
