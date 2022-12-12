const Confirm = require('prompt-confirm');
const config = require("./deploy_config.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;
  //const shares = await deployments.get('Shares');
  //const shares = await deployments.get("AllowlistShares" + config.symbol);
  const shares = "0x553C7f9C780316FC1D34b8e14ac2465Ab22a090B"
  //const paymentHub = await deployments.get('PaymentHub');
  const paymentHub = "0xfb330379134EA1EfCE9Cf6F28E2CcB917899e007";
  
  const price = config.sharePrice;
  const increment = config.increment;
  const baseCurrencyContract = config.baseCurrencyAddress;
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Brokerbot " + config.symbol);
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares);
    console.log("paymentHub: %s", paymentHub);
    console.log("base xchf: %s", baseCurrencyContract);
    console.log("owner: %s", owner);  // don't forget to set it in deploy_config.js as the multsigadr

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Brokerbot"+config.symbol, {
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

  // auto verify on etherscan
  await hre.run("etherscan-verify", {
    license: "None"
  });
};



module.exports.tags = ["Brokerbot"+config.symbol];
//module.exports.dependencies = ["AllowlistShares"+config.symbol, "PaymentHub"];