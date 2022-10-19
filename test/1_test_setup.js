// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");
const { ethers } = require("hardhat");
const { setup } = require("./helper/index");
const { expect } = require("chai");

describe("Migration", () => {
  let baseCurrency;
  let brokerbot;
  let recoveryHub;
  let offerFactory;
  let draggableShares;
  let shares;
  let paymentHub;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;
  let oracle;

  // do all set
  before(async function () {
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    // deploy contracts
    await setup();

    // get references
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggableShares = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
   });
   
  it("should have some ETH in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await ethers.provider.getBalance(accounts[i]);
      expect(balance.isZero(), "Balance is 0").to.be.false;
    }
  });

  it("should have some BaseCurrency in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await baseCurrency.balanceOf(accounts[i]);
      expect(balance.isZero(), "Balance is 0").to.be.false;
    }
  });

  it("should have some Shares in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await shares.balanceOf(accounts[i]);
      expect(balance.isZero(), "Balance is 0").to.be.false;
    }
  });

  it("should have some DraggableShares in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = await draggableShares.balanceOf(accounts[i]);
      expect(balance.isZero(), "Balance is 0").to.be.false;
    }
  });

  it("should have DraggableShares and BaseCurrency deposited into the Brokerbot", async () => {
    const tokenBalance = await draggableShares.balanceOf(brokerbot.address);
    const baseBalance = await baseCurrency.balanceOf(brokerbot.address);
    expect(tokenBalance.isZero()).to.eq(false, "Balance is 0");
    expect(baseBalance.isZero()).to.eq(false, "Balance is 0");
  });
});
