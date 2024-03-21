// Shared Config
const config = require("../scripts/deploy_config_mainnet.js");

// Libraries
const { getUnnamedAccounts } = require("hardhat");
const { expect } = require("chai");
const { setup } = require("./helper/index");

// Test parameters
const sharesToMint = 10n;

describe("Shares", () => {
  let accounts;
  let shares;
  let paymentHub;

  let deployer;
  let owner;
  let sig1

  before(async function () {
    [deployer,owner,sig1] = await ethers.getSigners();
    accounts =  await getUnnamedAccounts();
    // deploy contracts
    await setup(true);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    
  });

  it("should deploy", async () => {
    expect(await shares.getAddress()).to.exist;
  });

  it("should get constructor params correctly", async () => {
    const symbol = await shares.symbol.call();
    expect(symbol).to.equal(config.symbol);
    const name = await shares.name.call();
    expect(name).to.equal(config.name);
    const terms = await shares.terms.call();
    expect(terms).to.equal(config.terms);
    const totalShares = await shares.totalShares.call();
    expect(totalShares).to.equal(config.totalShares);
  });

  it("should be mintable", async () => {
    const oldBalance = await shares.balanceOf(accounts[0]);
    await shares.connect(owner).mint(accounts[0], sharesToMint);
    const newBalance = await shares.balanceOf(accounts[0]);
    expect(oldBalance+sharesToMint).to.equal(newBalance);
  });

  it("should allow infinite allowance", async () => {
    // Used Contracts: Shares, PaymentHub
    // Allow PaymentHub to spend infinite shares from accounts[0]
    await shares.connect(sig1).approve(await paymentHub.getAddress(), config.infiniteAllowance);

    // Get allowance before transaction
    const allowanceBefore = await shares.allowance(accounts[0], await paymentHub.getAddress());

    // Execute transaction. Send any number through paymentHub
    await paymentHub.connect(sig1).multiPay(await shares.getAddress(), [accounts[1]], [1]);

    // Get allowance after transaction
    const allowanceAfter = await shares.allowance(accounts[0], await paymentHub.getAddress());

    // Infinite approval must not have changed
    expect(allowanceBefore).to.equal(allowanceAfter);
    
  });
});
