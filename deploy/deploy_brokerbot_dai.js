const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const shares = await deployments.get('Shares');
  const paymentHub = await deployments.get('PaymentHub');

  console.log("-----------------------")
  console.log("Deploy Brokerbot")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account

  if (network.name == "mainnet") {
    await new Confirm("Addresses correct?").run();
  }

  const price = "500000000000000000";
  const increment = 10;
  const baseCurrencyContract = "0x6b175474e89094c44da98b954eedeac495271d0f"; // DAI Contract

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("BrokerbotDAI", {
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

module.exports.tags = ["BrokerbotDAI"];
module.exports.dependencies = ["Shares", "PaymentHub"];