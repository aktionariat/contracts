const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const shares = await deployments.get('SSADraggableShares');
  const paymentHub = await deployments.get('PaymentHub');
  
  const price = "1000000000000000000";
  const increment = 0;
  const baseCurrencyContract = "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08";
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Swiss Shore Brokerbot");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account
    console.log("paymentHub: %s", paymentHub.address);
    console.log("base xchf: %s", baseCurrencyContract);
    console.log("shares: %s", shares.address);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("SSABrokerbot", {
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

module.exports.tags = ["SSABrokerbot"];
module.exports.dependencies = ["SSADraggableShares", "PaymentHub"];