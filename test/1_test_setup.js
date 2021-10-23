/* global artifacts, contract, web3, assert */

// Shared Migration Config
const config = require("../migrations/migration_config");

// Libraries
const BN = require("bn.js");
const hre = require("hardhat");
const { artifacts } = require("hardhat");

// Used contracts
const ERC20 = artifacts.require("ERC20");
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");
const RecoveryHub = artifacts.require("RecoveryHub");

const ForceSend = artifacts.require("ForceSend");
const ERC20Basic = artifacts.require("ERC20Basic");

contract("Migration", (accounts) => {
  // do all set
  before(async function () {
    const baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
    const brokerbot = await Brokerbot.deployed();
    const recoveryHub = await RecoveryHub.deployed();
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
      await baseCurrency.mint(accounts[i], web3.utils.toWei("10000000"), { from: await signer.getAddress()});
      // console.log("account %s chf %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
    }
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: ["0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9"],
    });

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
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    for (let i = 0; i < 5; i++) {
      const balance = await erc20.balanceOf(accounts[i]);
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
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    const brokerbot = await Brokerbot.deployed();
    const tokenBalance = await draggableShares.balanceOf(brokerbot.address);
    const baseBalance = await erc20.balanceOf(brokerbot.address);
    assert(!tokenBalance.isZero() && !baseBalance.isZero());
  });
});
