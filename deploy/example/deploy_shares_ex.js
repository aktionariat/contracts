const Confirm = require('prompt-confirm');
const config = require("./deploy_config.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;
  const recoveryHub = await deployments.get("RecoveryHub");
  const permit2Hub = await deployments.get("Permit2Hub");

  const symbol = config.symbol;
  const name = config.name;
  const terms = config.terms;
  const totalShares = config.totalShares;
  
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Shares "+ config.symbol)
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("permit2hub: %s", permit2Hub.address);
    console.log("owner: %s", owner); // don't forget to set it in deploy_config.js as the multsigadr

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();
  
  const { address } = await deploy("Shares"+config.symbol, {
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

module.exports.tags = ["Shares"+config.symbol];
module.exports.dependencies = ["RecoveryHub"];