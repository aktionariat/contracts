// Shared Migration Config
const config = require("./migration_config");

// Import Contracts
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");

// This is the entry point of execution
module.exports = function(deployer, network, accounts) {
  
  // Deploy the share contract with test name and ticker
  deployer.deploy(Shares, config.symbol, config.name, config.terms, config.totalShares, accounts[0])
  .then(() => {
    // Deploy DTEST DraggableShares wrapping TEST shares
    return deployer.deploy(DraggableShares, config.terms, Shares.address, config.quorumBps, config.votePeriodSeconds);
  })
  .then(() => {
    // Deploy the Brokerbot contract for trading DTEST
    return deployer.deploy(Brokerbot, DraggableShares.address, config.sharePrice, 0, config.baseCurrencyAddress, accounts[0]);
  })
  .then(() => {
    // Deploy the Payment Hub that can be used with the Brokerbot
    return deployer.deploy(PaymentHub, config.baseCurrencyAddress);
  })
  .then(() => {
    console.log("TEST Share Address: " + Shares.address);
    console.log("DTEST Draggable Share Address: " + DraggableShares.address);
    console.log("Brokerbot Contract Address : " + Brokerbot.address); 
    console.log("PaymentHub Address : " + PaymentHub.address); 
    console.log("BaseCurrency : " + config.baseCurrencyAddress); 
    console.log("Owner Address: " + accounts[0]);
  });

};