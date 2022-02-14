/* global artifacts, web3 */

// Libraries
const BN = require("bn.js");
const hre = require("hardhat");
const { artifacts, getUnnamedAccounts} = require("hardhat");
const { sendEther, setBalance } = require("./helper/index");

// Shared Config
const config = require("../scripts/deploy_config.js");

const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");
const RecoveryHub = artifacts.require("RecoveryHub");
const OfferFactory = artifacts.require("OfferFactory");

const priceFeedCHFUSD = "0x449d117117838fFA61263B61dA6301AA2a88B13A";  // ethereum mainnet
const priceFeedETHUSD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ethereum mainnet
const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Import Contracts
const ERC20Basic = artifacts.require("ERC20Basic");

module.exports = async (deployer) => {
  const namedAcc = await deployer.getNamedAccounts();
  const accounts = await getUnnamedAccounts();
  const [deploy] = await ethers.getSigners();

  const recoveryHub = await RecoveryHub.new();
  RecoveryHub.setAsDeployed(recoveryHub);

  const offerFactory = await OfferFactory.new();
  OfferFactory.setAsDeployed(offerFactory);

  const shares = await Shares.new(config.symbol, config.name, config.terms, config.totalShares, namedAcc.deployer, recoveryHub.address);
  Shares.setAsDeployed(shares);

  const draggableShares = await DraggableShares.new(config.terms, shares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, accounts[0]);
  DraggableShares.setAsDeployed(draggableShares);

  const paymentHub = await PaymentHub.new(uniswapQuoter, uniswapRouter, priceFeedCHFUSD, priceFeedETHUSD);
  PaymentHub.setAsDeployed(paymentHub);

  const brokerbot = await Brokerbot.new(draggableShares.address, config.sharePrice, 0, config.baseCurrencyAddress, namedAcc.deployer, paymentHub.address);
  Brokerbot.setAsDeployed(brokerbot);


  const baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
  // Set Payment Hub for Brokerbot
  await brokerbot.setPaymentHub(paymentHub.address);

  // Allow payment hub to spend baseCurrency from accounts[0] and draggableShares from Brokerbot
  await draggableShares.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts[0] });
  await baseCurrency.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts[0] });
  await brokerbot.approve(draggableShares.address, paymentHub.address, new BN(config.infiniteAllowance));
  await brokerbot.approve(baseCurrency.address, paymentHub.address, new BN(config.infiniteAllowance));

  // Mint ETH to copyright owner for sending transactions
  /*const forceSend = await ForceSend.new();
  await forceSend.send(config.brokerbotCopyrightOwnerAddress, {value: 1000000000000000000})*/
  sendEther(deploy, config.brokerbotCopyrightOwnerAddress, "1");

  // Mint BaseCurrency to first 5 accounts
  await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);

  // Mint Shares to first 5 accounts
  for (let i = 0; i < 5; i++) {
    await shares.mint(accounts[i], 1000000);
  }

  // Convert some Shares to DraggableShares
  for (let i = 0; i < 5; i++) {
    await shares.approve(draggableShares.address, config.infiniteAllowance, { from: accounts[i] });
    await draggableShares.wrap(accounts[i], 800000, { from: accounts[i] });
  }

  // Deposit some shares to Brokerbot
  await draggableShares.transfer(brokerbot.address, 500000, { from: accounts[0]});
  await baseCurrency.transfer(brokerbot.address, web3.utils.toWei("100000"), { from: accounts[0] });
};
