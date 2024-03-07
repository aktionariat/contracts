const Confirm = require('prompt-confirm');
const config = require("../scripts/deploy_config.js");
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const signatureTransfer = await deployments.get('SignatureTransfer');
  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy deposit demo")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("signatureTransfer: %s", signatureTransfer.address);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("DepositDemo", {
    contract: "DepositDemo",
    from: deployer,
    args: [
      signatureTransfer.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["DepositDemo"];
module.exports.dependencies = ["SignatureTransfer"];