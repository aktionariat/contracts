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
  let shares = await Shares.deployed();
  let draggableShares = await DraggableShares.deployed();
  let baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
  let brokerbot = await Brokerbot.deployed();

  // Mint ETH to copyright owner for sending transactions
  let forceSend = await ForceSend.new();
  await forceSend.send(config.brokerbotCopyrightOwnerAddress, {value: 1000000000000000000})
 
  // Mint BaseCurrency to first 5 accounts
  let forceSend2 = await ForceSend.new();
  await forceSend2.send(config.baseCurrencyMinterAddress, {value: 1000000000000000000})
  for (var i = 0 ; i < 5 ; i++) {
    await baseCurrency.mint(accounts[i], web3.utils.toWei("10000000"), { from: config.baseCurrencyMinterAddress });
  }

  // Mint Shares to first 5 accounts
  for (var i = 0 ; i < 5 ; i++) {
    await shares.mint(accounts[i], 1000000);
  }

  // Convert some Shares to DraggableShares
  for (var i = 0 ; i < 5 ; i++) {
    await shares.approve(draggableShares.address, config.infiniteAllowance, { from: accounts[i] });
    await draggableShares.wrap(accounts[i], 800000, { from: accounts[i] });
  }

  // Deposit some shares to Brokerbot
  await draggableShares.transfer(brokerbot.address, 500000, { from: accounts[0] });
  await baseCurrency.transfer(brokerbot.address, web3.utils.toWei("100000"), { from: accounts[0] });
};