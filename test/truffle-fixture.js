// Shared Migration Config
const config = require("../migrations/migration_config");

const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");

module.exports = async(deployer) => {
  console.log(await deployer.getNamedAccounts());
  const accounts = await deployer.getNamedAccounts();

  const shares = await Shares.new(config.symbol, config.name, config.terms, config.totalShares, accounts.deployer);
  Shares.setAsDeployed(shares);

  const draggableShares = await DraggableShares.new(config.terms, Shares.address, config.quorumBps, config.votePeriodSeconds);
  DraggableShares.setAsDeployed(draggableShares);

  const brokerbot = await Brokerbot.new(DraggableShares.address, config.sharePrice, 0, config.baseCurrencyAddress, accounts.deployer);
  Brokerbot.setAsDeployed(brokerbot);

  const paymentHub = await PaymentHub.new(config.baseCurrencyAddress);
  PaymentHub.setAsDeployed(paymentHub);
    };
