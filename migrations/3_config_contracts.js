// Shared Migration Config
const config = require("./migration_config");

// Libraries
const BN = require('bn.js');

// Import Contracts
const ForceSend = artifacts.require("ForceSend");
const ERC20Basic = artifacts.require("ERC20Basic");
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");

// This is the entry point of execution
module.exports = async function(deployer, network, accounts) {
  // Contracts used
  let draggableShares = await DraggableShares.deployed();
  let baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
  let brokerbot = await Brokerbot.deployed();
  let paymentHub = await PaymentHub.deployed();

  // Set Payment Hub for Brokerbot
  await brokerbot.setPaymentHub(paymentHub.address);

  // Allow payment hub to spend baseCurrency from accounts[0] and draggableShares from Brokerbot
  await draggableShares.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts[0] });
  await baseCurrency.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts[0] });
  await brokerbot.approve(draggableShares.address, paymentHub.address, new BN(config.infiniteAllowance));
  await brokerbot.approve(baseCurrency.address, paymentHub.address, new BN(config.infiniteAllowance));

}