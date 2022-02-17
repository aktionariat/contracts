const Confirm = require('prompt-confirm');
// Shared  Config
const config = require("../scripts/deploy_config.js"); //use other config for other customers

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");

  const symbol = config.symbol;
  const name = config.name;
  const terms = config.terms;
  const totalShares = config.totalShares;
  const l2Bridge = "0x4200000000000000000000000000000000000010";
  const l1Token = "0xCb1D5644297502812f9545e5C6d6C6479d0d1666";
  
  //if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy OptimismShares")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("owner: %s", owner); // don't forget to set it in the hardhat config

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  //}

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("OptimismShares", {
    contract: "OptimismShares",
    from: deployer,
    args: [
      l2Bridge,
      l1Token,
      symbol,
      name,
      terms,
      totalShares,
      owner,
      recoveryHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["OptimismShares"];
module.exports.dependencies = ["RecoveryHub"];