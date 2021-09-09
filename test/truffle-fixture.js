// Shared Migration Config
const config = require("../migrations/migration_config");

const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");

module.exports = async(deployer) => {
  const accounts = await deployer.getNamedAccounts();
  const unAccounts = await deployer.getUnNamedAccounts();
  console.log(unAccounts);

  const shares = await Shares.new(config.symbol, config.name, config.terms, config.totalShares, accounts.deployer);
  Shares.setAsDeployed(shares);

  const draggableShares = await DraggableShares.new(config.terms, shares.address, config.quorumBps, config.votePeriodSeconds);
  DraggableShares.setAsDeployed(draggableShares);

  const brokerbot = await Brokerbot.new(draggableShares.address, config.sharePrice, 0, config.baseCurrencyAddress, accounts.deployer);
  Brokerbot.setAsDeployed(brokerbot);

  const paymentHub = await PaymentHub.new(config.baseCurrencyAddress);
  PaymentHub.setAsDeployed(paymentHub);
    };
