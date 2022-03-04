const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  let priceFeedCHFUSD;
  let priceFeedETHUSD;
  if (network.name == "kovanOptimism") {
    priceFeedCHFUSD = "0x4Dab1Dc2409A037d80316F2379Ac767A477C4236";  // usdt/usd optimism kovan
    priceFeedETHUSD = "0xCb7895bDC70A1a1Dce69b689FD7e43A627475A06"; // optimism kovan
  } else {
    priceFeedCHFUSD = "0xECef79E109e997bCA29c1c0897ec9d7b03647F5E";  // usdt/usd optimism 
    priceFeedETHUSD = "0x13e3Ee699D1909E989722E753853AE30b17e08c5"; // optimism 
  }
  const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Paymenthub Optimism");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("chainlink chf usd: %s", priceFeedCHFUSD);
    console.log("chainlink eth usd", priceFeedETHUSD);
    console.log("uniswap qouter: %s", uniswapQuoter);
    console.log("uniswap router: %s", uniswapRouter);

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
      uniswapQuoter,
      uniswapRouter
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHub"];