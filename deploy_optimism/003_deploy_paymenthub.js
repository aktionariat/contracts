const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Paymenthub Optimism");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
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