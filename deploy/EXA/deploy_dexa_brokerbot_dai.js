const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = "0x7c1c862953165cd5a01cfaa13ef539dfdd93a9b6"
  const shares = "0xbf0e13ab37573ABB68ff9C33Ee9FF8148b8a61E2"
  const paymentHub = await deployments.get('PaymentHub');
  
  const price = "500000000000000000";
  const increment = 20000000000000;
  const baseCurrencyContract = "0x6b175474e89094c44da98b954eedeac495271d0f"; // DAI Contract
    
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Brokerbot DAI")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares);
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

  const { address } = await deploy("DEXABrokerbotDAI", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      shares,
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

module.exports.tags = ["DEXABrokerbotDAI"];
module.exports.dependencies = ["PaymentHub"];