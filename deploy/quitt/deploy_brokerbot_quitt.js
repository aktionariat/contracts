const Confirm = require('prompt-confirm');
const config = require("../quitt/deploy_config_quitt.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;
  const shares = config.sharesAddress;
  const paymentHub = config.paymentHubAddress;
  
  const price = config.sharePrice;
  const increment = config.increment;
  const baseCurrencyContract = config.baseCurrencyAddress;
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Brokerbot Quitt");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares);
    console.log("paymentHub: %s", paymentHub);
    console.log("base xchf: %s", baseCurrencyContract);
    console.log("owner: %s", owner);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("BrokerbotQuitt", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      shares,
      price,
      increment,
      baseCurrencyContract,
      owner,
      paymentHub],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["BrokerbotQuitt"];