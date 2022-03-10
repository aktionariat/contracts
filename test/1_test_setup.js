// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");
const { artifacts, getUnnamedAccounts } = require("hardhat");
const { setBalance, setup } = require("./helper/index");

// Used contracts
/*const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");
const PaymentHub = artifacts.require("PaymentHub");
const RecoveryHub = artifacts.require("RecoveryHub");
const OfferFactory = artifacts.require("OfferFactory");

const ERC20Basic = artifacts.require("ERC20Basic");*/

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
    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);
    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggableShares = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
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
