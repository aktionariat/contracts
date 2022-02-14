/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");

const { artifacts, getUnnamedAccounts } = require("hardhat");

// Import contracts to be tested
const Shares = artifacts.require("Shares");
const PaymentHub = artifacts.require("PaymentHub");

// Test parameters
const sharesToMint = 10;

contract("Shares", () => {
  let accounts;
  let shares;
  let paymentHub;

  before(async function () {
    accounts =  await getUnnamedAccounts();
    shares = await Shares.deployed();
    paymentHub = await PaymentHub.deployed();
  });

  it("should deploy", async () => {
    assert(shares.address !== "");
  });

  it("should get constructor params correctly", async () => {
    const symbol = await shares.symbol.call();
    assert.equal(symbol, config.symbol);
    const name = await shares.name.call();
    assert.equal(name, config.name);
    const terms = await shares.terms.call();
    assert.equal(terms, config.terms);
    const totalShares = await shares.totalShares.call();
    assert.equal(totalShares, config.totalShares);
  });

  it("should be mintable", async () => {
    const oldBalance = await shares.balanceOf(accounts[0]);
    await shares.mint(accounts[0], sharesToMint);
    const newBalance = await shares.balanceOf(accounts[0]);
    assert.equal(oldBalance.toNumber() + sharesToMint, newBalance.toNumber());
  });

  it("should allow infinite allowance", async () => {
    // Used Contracts: Shares, PaymentHub
    // Allow PaymentHub to spend infinite shares from accounts[0]
    await shares.approve(paymentHub.address, config.infiniteAllowance, {
      from: accounts[0],
    });

    // Get allowance before transaction
    const allowanceBefore = new BN(
      await shares.allowance(accounts[0], paymentHub.address)
    );

    // Execute transaction. Send any number through paymentHub
    await paymentHub.multiPay(shares.address, [accounts[1]], [1], {
      from: accounts[0],
    });

    // Get allowance after transaction
    const allowanceAfter = new BN(
      await shares.allowance(accounts[0], paymentHub.address)
    );

    // Infinite approval must not have changed
    assert(allowanceBefore.eq(allowanceAfter));
  });
});
