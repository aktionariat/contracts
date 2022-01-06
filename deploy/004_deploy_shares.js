const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");

  console.log("-----------------------")
  console.log("Deploy Shares")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("recoveryHub: %s", recoveryHub.address);
  console.log("owner: %s", owner); // don't forget to set it in the hardhat config

  const symbol = "SHR";
  const name = "Test Share ";
  const terms = "wwww.terms.ch";
  const totalShares = 10000000;

  let prompt;
  if (network.name != "hardhat") {
    prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  if (network.name == "mainnet") {
    await new Confirm("Addresses correct?").run();
  }

  const { address } = await deploy("Shares", {
    contract: "Shares",
    from: deployer,
    args: [
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

module.exports.tags = ["Shares"];
module.exports.dependencies = ["RecoveryHub"];