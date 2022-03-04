const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  //const redstoneProvider = 0x0C39486f770B26F5527BBBf942726537986Cd7eb; //redstone main demo provider 
  const redstoneProvider = "0x926E370fD53c23f8B71ad2B3217b227E41A92b12"; //redstone stocks provider (includes eth and chf)

  const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Paymenthub Optimism");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("redstone provider signer: %s", redstoneProvider);
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
      uniswapRouter,
      redstoneProvider
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHub"];