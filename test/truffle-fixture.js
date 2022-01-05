/* global artifacts, web3 */

// Libraries
const BN = require("bn.js");
const hre = require("hardhat");
const { artifacts } = require("hardhat");

// Shared Migration Config
const config = require("../migrations/migration_config");

const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");
const RecoveryHub = artifacts.require("RecoveryHub");
const OfferFactory = artifacts.require("OfferFactory");

const priceFeedCHFUSD = "0x449d117117838fFA61263B61dA6301AA2a88B13A";  // ethereum mainnet
const priceFeedETHUSD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ethereum mainnet

// Import Contracts
const ForceSend = artifacts.require("ForceSend");
const ERC20Basic = artifacts.require("ERC20Basic");

module.exports = async (deployer) => {
  const accounts = await deployer.getNamedAccounts();
  const unAccounts = await deployer.getUnnamedAccounts();

  const recoveryHub = await RecoveryHub.new();
  RecoveryHub.setAsDeployed(recoveryHub);

  const offerFactory = await OfferFactory.new();
  OfferFactory.setAsDeployed(offerFactory);

  const shares = await Shares.new(config.symbol, config.name, config.terms, config.totalShares, accounts.deployer, recoveryHub.address);
  Shares.setAsDeployed(shares);

  const draggableShares = await DraggableShares.new(config.terms, shares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, accounts.deployer);
  DraggableShares.setAsDeployed(draggableShares);

  const paymentHub = await PaymentHub.new(priceFeedCHFUSD, priceFeedETHUSD);
  PaymentHub.setAsDeployed(paymentHub);

  const brokerbot = await Brokerbot.new(draggableShares.address, config.sharePrice, 0, config.baseCurrencyAddress, accounts.deployer, paymentHub.address);
  Brokerbot.setAsDeployed(brokerbot);


  const baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
  // Set Payment Hub for Brokerbot
  await brokerbot.setPaymentHub(paymentHub.address);

  // Allow payment hub to spend baseCurrency from accounts[0] and draggableShares from Brokerbot
  await draggableShares.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts.deployer });
  await baseCurrency.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts.deployer });
  await brokerbot.approve(draggableShares.address, paymentHub.address, new BN(config.infiniteAllowance));
  await brokerbot.approve(baseCurrency.address, paymentHub.address, new BN(config.infiniteAllowance));

  // Mint ETH to copyright owner for sending transactions
  const forceSend = await ForceSend.new();
  await forceSend.send(config.brokerbotCopyrightOwnerAddress, {value: 1000000000000000000})

  // Mint BaseCurrency to first 5 accounts
  const forceSend2 = await ForceSend.new();
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9"],
  });
  const signer = await ethers.getSigner("0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9")
  await forceSend2.send(config.baseCurrencyMinterAddress, {value: 1000000000000000000})
  for (let i = 0; i < 5; i++) {
    await baseCurrency.mint(unAccounts[i], web3.utils.toWei("10000000"), { from: await signer.getAddress()});
    // console.log("account %s chf %s", unAccounts[i], await baseCurrency.balanceOf(unAccounts[i]));
  }
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: ["0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9"],
  });

  // Mint Shares to first 5 accounts
  for (let i = 0; i < 5; i++) {
    await shares.mint(unAccounts[i], 1000000);
  }

  // Convert some Shares to DraggableShares
  for (let i = 0; i < 5; i++) {
    await shares.approve(draggableShares.address, config.infiniteAllowance, { from: unAccounts[i] });
    await draggableShares.wrap(unAccounts[i], 800000, { from: unAccounts[i] });
  }

  // Deposit some shares to Brokerbot
  await draggableShares.transfer(brokerbot.address, 500000, { from: unAccounts[0]});
  await baseCurrency.transfer(brokerbot.address, web3.utils.toWei("100000"), { from: unAccounts[0] });
};
