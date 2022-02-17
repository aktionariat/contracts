const Confirm = require('prompt-confirm');
// Shared  Config
const config = require("../scripts/deploy_config.js"); //use other config for other customers

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const l2Bridge = "0x4200000000000000000000000000000000000010";
  const l1Token = "0xbe2057bAC4157Bba00759f61dacB08A64F703C2d";
  
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy SIMPLE XCHF")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", deployer); // don't forget to set it in the hardhat config

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("SimpleCryptoFranc", {
    contract: "SimpleCryptoFranc",
    from: deployer,
    args: [
      l2Bridge,
      l1Token],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["SimpleCryptoFranc"];