// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const { artifacts, getUnnamedAccounts } = require("hardhat");
const { expect } = require("chai");

// Test parameters
const sharesToMint = 10;

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
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    
  });

  it("should deploy", async () => {
    expect(shares.address).to.exist;
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
    expect(oldBalance.add(sharesToMint)).to.equal(newBalance);
    //assert.equal(oldBalance.toNumber() + sharesToMint, newBalance.toNumber());
  });

  it("should allow infinite allowance", async () => {
    // Used Contracts: Shares, PaymentHub
    // Allow PaymentHub to spend infinite shares from accounts[0]
    await shares.connect(sig1).approve(paymentHub.address, config.infiniteAllowance);

    // Get allowance before transaction
    const allowanceBefore = await shares.allowance(accounts[0], paymentHub.address);

    // Execute transaction. Send any number through paymentHub
    await paymentHub.connect(sig1).multiPay(shares.address, [accounts[1]], [1]);

    // Get allowance after transaction
    const allowanceAfter = await shares.allowance(accounts[0], paymentHub.address);

    // Infinite approval must not have changed
    expect(allowanceBefore).to.equal(allowanceAfter);
    
  });
});
