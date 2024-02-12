const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");
  const permit2Hub = await deployments.get("Permit2Hub");
  
  const symbol = "ASHR";
  const name = "Test Allowlist Shares";
  const terms = "wwww.terms.ch";
  const totalShares = 4000000;

  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Allowlist Shares")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("permit2hub: %s", permit2Hub.address);
    console.log("owner: %s", owner)  // don't forget to set it in hardhat.config.js as the multsig account
    
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  
  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("AllowlistShares", {
    contract: "AllowlistShares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      recoveryHub.address,
      owner,
      permit2Hub.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["AllowlistShares"];
module.exports.dependencies = ["RecoveryHub", "Permit2Hub"];