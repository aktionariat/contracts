const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  
  const priceFeedCHFUSD = "0x449d117117838fFA61263B61dA6301AA2a88B13A";  // ethereum mainnet
  const priceFeedETHUSD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ethereum mainnet
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Paymenthub");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("chainlink chf usd: %s", priceFeedCHFUSD);
    console.log("chainlink eth usd", priceFeedETHUSD);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("PaymentHub", {
    contract: "PaymentHub",
    from: deployer,
    args: [
      priceFeedCHFUSD,
      priceFeedETHUSD],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHub"];