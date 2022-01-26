const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  
  const priceFeedCHFUSD = "0x4Dab1Dc2409A037d80316F2379Ac767A477C4236";  // usdt/usd optimism kovan
  const priceFeedETHUSD = "0xCb7895bDC70A1a1Dce69b689FD7e43A627475A06"; // optimism kovan
  //const priceFeedETHUSD = "0x13e3Ee699D1909E989722E753853AE30b17e08c5"; // optimism 
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Paymenthub Optimism");
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