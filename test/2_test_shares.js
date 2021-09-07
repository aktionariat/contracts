// Shared Migration Config
const config = require("../migrations/migration_config");

// Libraries
const BN = require('bn.js');

// Import contracts to be tested
const Shares = artifacts.require("Shares");
const PaymentHub = artifacts.require("PaymentHub");

// Test parameters
const sharesToMint = 10;

contract('Shares', accounts => {
  it('should deploy', async () => {
    let shares = await Shares.deployed();
    assert(shares.address !== '');
  })

  it('should get constructor params correctly', async () => {
    let shares = await Shares.deployed();
    let symbol = await shares.symbol.call();
    assert.equal(symbol, config.symbol);
    let name = await shares.name.call();
    assert.equal(name, config.name);
    let terms = await shares.terms.call();
    assert.equal(terms, config.terms);
    let totalShares = await shares.totalShares.call();
    assert.equal(totalShares, config.totalShares);
  })

  it('should be mintable', async () => {
    let shares = await Shares.deployed();
    let oldBalance = await shares.balanceOf(accounts[0]);
    await shares.mint(accounts[0], sharesToMint);
    let newBalance = await shares.balanceOf(accounts[0]);
    assert.equal(oldBalance.toNumber() + sharesToMint, newBalance.toNumber());
  })

  it('should allow infinite allowance', async () => {
    // Used Contracts: Shares, PaymentHub
    let shares = await Shares.deployed();
    let paymentHub = await PaymentHub.deployed();

    // Allow PaymentHub to spend infinite shares from accounts[0]
    await shares.approve(paymentHub.address, config.infiniteAllowance, { from: accounts[0] });

    // Get allowance before transaction
    let allowanceBefore = new BN(await shares.allowance(accounts[0], paymentHub.address));

    // Execute transaction. Send any number through paymentHub
    await paymentHub.multiPay(shares.address, [accounts[1]], [1], { from: accounts[0] })

    // Get allowance after transaction
    let allowanceAfter = new BN(await shares.allowance(accounts[0], paymentHub.address));

    // Infinite approval must not have changed
    assert(allowanceBefore.eq(allowanceAfter));
  })
})