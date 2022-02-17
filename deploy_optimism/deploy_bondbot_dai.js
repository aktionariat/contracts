const Confirm = require('prompt-confirm');
const config = require("../scripts/deploy_config_optimism.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const bond = await deployments.get('Bond');
  const paymentHub = await deployments.get('PaymentHub');
  
  const price = "500000000000000000";
  const increment = 0;
  const baseCurrencyContract = config.daiAddress; // DAI Contract optimism
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Bondbot DAI");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("bond: %s", bond.address);
    console.log("paymentHub: %s", paymentHub.address);
    console.log("base dai: %s", baseCurrencyContract);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account
  
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("BondbotDAI", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      bond.address,
      price,
      increment,
      baseCurrencyContract,
      owner,
      paymentHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["BondbotDAI"];
module.exports.dependencies = ["Bond", "PaymentHub"];