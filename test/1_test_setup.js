/* global artifacts, contract, web3, assert */

// Shared Migration Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");
const hre = require("hardhat");
const { artifacts } = require("hardhat");
const { sendEther, setBalance } = require("./helper/index");  

// Used contracts
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");
const RecoveryHub = artifacts.require("RecoveryHub");
const OfferFactory = artifacts.require("OfferFactory");

const ERC20Basic = artifacts.require("ERC20Basic");

contract("Migration", (accounts) => {
  // do all set
  before(async function () {
    const [deployer] = await ethers.getSigners();
    const baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
    const brokerbot = await Brokerbot.deployed();
    const recoveryHub = await RecoveryHub.deployed();
    const offerFactory = await OfferFactory.deployed();
    const draggableShares = await DraggableShares.deployed();
    const shares = await Shares.deployed();
    const paymentHub = await PaymentHub.deployed();
    // Set Payment Hub for Brokerbot
    await brokerbot.setPaymentHub(paymentHub.address);

    // Allow payment hub to spend baseCurrency from accounts[0] and draggableShares from Brokerbot
    await draggableShares.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts.deployer });
    await baseCurrency.approve(paymentHub.address, new BN(config.infiniteAllowance), { from: accounts.deployer });
    await brokerbot.approve(draggableShares.address, paymentHub.address, new BN(config.infiniteAllowance));
    await brokerbot.approve(baseCurrency.address, paymentHub.address, new BN(config.infiniteAllowance));

    // Mint ETH to copyright owner for sending transactions
    sendEther(deployer, config.brokerbotCopyrightOwnerAddress, "1");
    // Mint BaseCurrency to first 5 accounts
    await setBalance(baseCurrency, 2, accounts);

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
  });
  it("should have some ETH in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = new BN(await web3.eth.getBalance(accounts[i]));
      assert(!balance.isZero(), "Balance is 0");
    }
  });

  it("should have some BaseCurrency in first 5 accounts", async () => {
    const baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
    for (let i = 0; i < 5; i++) {
      const balance = await baseCurrency.balanceOf(accounts[i]);
      assert(!balance.isZero(), "Balance is 0");
    }
  });

  it("should have some Shares in first 5 accounts", async () => {
    const shares = await Shares.deployed();
    for (let i = 0; i < 5; i++) {
      const balance = await shares.balanceOf(accounts[i]);
      assert(!balance.isZero(), "Balance is 0");
    }
  });

  it("should have some DraggableShares in first 5 accounts", async () => {
    const draggableShares = await DraggableShares.deployed();
    for (let i = 0; i < 5; i++) {
      const balance = await draggableShares.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  });

  it("should have DraggableShares and BaseCurrency deposited into the Brokerbot", async () => {
    const draggableShares = await DraggableShares.deployed();
    const brokerbot = await Brokerbot.deployed();
    const baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
    const tokenBalance = await draggableShares.balanceOf(brokerbot.address);
    const baseBalance = await baseCurrency.balanceOf(brokerbot.address);
    assert(!tokenBalance.isZero() && !baseBalance.isZero());
  });
});
