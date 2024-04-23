const Confirm = require('prompt-confirm');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");
  const permit2Hub = await deployments.get("Permit2Hub");

  const symbol = config.symbol;
  const name = config.name;
  const terms = config.terms;
  const totalShares = config.totalShares;

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
