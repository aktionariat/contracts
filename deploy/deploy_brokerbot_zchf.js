const Confirm = require('prompt-confirm');
const { getConfigPath } = require('../scripts/utils.js');
const { getGasPrice } = require('../scripts/helper/polygongasstation.js');
// Shared  Config
const config = require(`..${getConfigPath()}`);

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const shares = await deployments.get('Shares');
  const paymentHub = await deployments.get('PaymentHub');
  
  const price = ethers.parseUnits("100", 18);
  const increment = 10000000000000000n;
  const baseCurrencyContract = config.zchfAddress; // ZCHF Contract
    
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Brokerbot ZCHF")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("paymentHub: %s", paymentHub.address);
    console.log("base zchf: %s", baseCurrencyContract);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  // const feeData = await ethers.provider.getFeeData();
  const feeData = await getGasPrice();

  const { address } = await deploy("BrokerbotZCHF", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      shares.address,
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

module.exports.tags = ["BrokerbotZCHF"];
module.exports.dependencies = ["Shares", "PaymentHub"];