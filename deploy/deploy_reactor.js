const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const signatureTransfer = await deployments.get('SignatureTransfer');
  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Trade Reactor")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("signatureTransfer: %s", signatureTransfer.address);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();

  const { address } = await deploy("TradeReactor", {
    contract: "TradeReactor",
    from: deployer,
    args: [
      signatureTransfer.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["TradeReactor"];
module.exports.dependencies = ["SignatureTransfer"];
