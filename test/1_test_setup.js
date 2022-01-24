/* global artifacts, contract, web3, assert */

// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");
const hre = require("hardhat");
const { artifacts, getUnnamedAccounts } = require("hardhat");

// Used contracts
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");
const RecoveryHub = artifacts.require("RecoveryHub");
const OfferFactory = artifacts.require("OfferFactory");

const ForceSend = artifacts.require("ForceSend");
const ERC20Basic = artifacts.require("ERC20Basic");

contract("Migration", () => {
  let accounts;
  let baseCurrency;
  let brokerbot;
  let recoveryHub;
  let offerFactory;
  let draggableShares;
  let shares;
  let paymentHub;

  // do all set
  before(async function () {
    accounts =  await getUnnamedAccounts();

    baseCurrency = await ERC20Basic.at(config.baseCurrencyAddress);
    brokerbot = await Brokerbot.deployed();
    recoveryHub = await RecoveryHub.deployed();
    offerFactory = await OfferFactory.deployed();
    draggableShares = await DraggableShares.deployed();
    shares = await Shares.deployed();
    paymentHub = await PaymentHub.deployed();
   });
   
  it("should have some ETH in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = new BN(await web3.eth.getBalance(accounts[i]));
      assert(!balance.isZero(), "Balance is 0");
    }
  });

  it("should have some BaseCurrency in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await baseCurrency.balanceOf(accounts[i]);
      assert(!balance.isZero(), "Balance is 0");
    }
  });

  it("should have some Shares in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await shares.balanceOf(accounts[i]);
      assert(!balance.isZero(), "Balance is 0");
    }
  });

  it("should have some DraggableShares in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await draggableShares.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  });

  it("should have DraggableShares and BaseCurrency deposited into the Brokerbot", async () => {
    const tokenBalance = await draggableShares.balanceOf(brokerbot.address);
    const baseBalance = await baseCurrency.balanceOf(brokerbot.address);
    assert(!tokenBalance.isZero() && !baseBalance.isZero());
  });
});
