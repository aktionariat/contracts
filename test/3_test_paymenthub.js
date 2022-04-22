// Shared Config
const config = require("../scripts/deploy_config_optimism.js");


const { setup } = require("./helper/index");

// Libraries
const { ethers} = require("hardhat");
const { expect } = require("chai");
const exp = require("constants");

// Import contracts to be tested

// Test parameters
const paymentAmountInBase = ethers.utils.parseEther("10");

describe("PaymentHub", () => {
  let paymentHub;
  let brokerbot;
  let base;
  let accounts;
  let deployer;
  let owner;
  let sig1;
  let sig2;
  let sig

  before( async () => {
    [deployer,owner,sig1,sig2,sig3] = await ethers.getSigners();
    accounts = [owner.address,sig1.address,sig2.address,sig3.address];
    paymentHub = await ethers.getContract("PaymentHub");
    brokerbot = await ethers.getContract("Brokerbot");

    base = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  });

  it("should deploy paymenthub", async () => {
    expect(paymentHub.address).to.exist;
  });

  it("should get price in ether", async () => {
    const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](paymentAmountInBase, brokerbot.address);
    expect(priceInETH).to.be.above(0);
  });

  it("should pay using Ether to recipient in baseCurrency", async () => {
    // Used contracts: PaymentHub, Base

    // Get balances before
    const ethBalanceSenderBefore = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientBefore = await base.balanceOf(accounts[1]);

    // Execute payment
    const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](paymentAmountInBase, brokerbot.address);
    const txInfo = await paymentHub.connect(owner).payFromEther(
      accounts[1],
      paymentAmountInBase,
      await brokerbot.base(),
      { value: priceInETH }
    );
    const { effectiveGasPrice, cumulativeGasUsed} = await txInfo.wait();
    const gasCost = effectiveGasPrice.mul(cumulativeGasUsed);

    // Get balances after
    const ethBalanceSenderAfter = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientAfter = await base.balanceOf(accounts[1]);

    // Check result
    expect(ethBalanceSenderBefore.sub(priceInETH).sub(gasCost)).to.equal(ethBalanceSenderAfter);
    expect(baseBalanceRecipientBefore.add(paymentAmountInBase)).to.equal(baseBalanceRecipientAfter);
  });

  it("should return unspent ETH to spender", async () => {
    // Used contracts: PaymentHub, Base
    // Get balances before
    const ethBalanceSenderBefore = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientBefore = await base.balanceOf(accounts[1]);

    // Calculate required ETH and set a slippage
    const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](paymentAmountInBase, brokerbot.address);
    const priceInEthWithSlippage = priceInETH.mul(103).div(100);

    // Execute transaction with increased ETH
    const txInfo = await paymentHub.connect(owner).payFromEther(
      accounts[1],
      paymentAmountInBase,
      await brokerbot.base(),
      { value: priceInEthWithSlippage }
    );
    const { effectiveGasPrice, cumulativeGasUsed} = await txInfo.wait();
    const gasCost = effectiveGasPrice.mul(cumulativeGasUsed);

    // Get balances after
    const ethBalanceSenderAfter = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientAfter = await base.balanceOf(accounts[1]);
    const ethBalancePaymentHubAfter = await ethers.provider.getBalance(paymentHub.address);
    const ethBalanceUniswapAfter = await ethers.provider.getBalance(config.uniswapRouterAddress);

    // Check result
    expect(ethBalanceSenderBefore.sub(priceInETH).sub(gasCost)).to.eq(ethBalanceSenderAfter);
    expect(baseBalanceRecipientBefore.add(paymentAmountInBase)).to.eq(baseBalanceRecipientAfter);
    expect(ethBalancePaymentHubAfter.isZero()).to.equal(true);
    expect(ethBalanceUniswapAfter.isZero()).to.equal(true);
  });

  it("should make multiple payments in baseCurrency in single transaction", async () => {
    // Used contracts: PaymentHub, base

    // Get 1/100 of accounts[0] token balance. Send 1, 3, 20 units to accounts[1],[2],[3] respectively.
    const balance = await base.balanceOf(accounts[0]);
    const toSendUnit = balance.div(100);
    const toSend1 = toSendUnit.mul(1);
    const toSend2 = toSendUnit.mul(3);
    const toSend3 = toSendUnit.mul(20);

    // get amount that is higher than account balance
    const toSendTooMuch = toSendUnit.mul(110);

    // Set allowance for paymentHub to spend baseCurrency tokens of account[0]
    await base.connect(owner).approve(paymentHub.address, config.infiniteAllowance);

    // Get balances before
    const balanceBefore0 = await base.balanceOf(accounts[0]);
    const balanceBefore1 = await base.balanceOf(accounts[1]);
    const balanceBefore2 = await base.balanceOf(accounts[2]);
    const balanceBefore3 = await base.balanceOf(accounts[3]);

    // check if reverts with too amount higher as balance
    await expect(paymentHub.connect(owner).multiPay(
      config.baseCurrencyAddress,
      [accounts[1], accounts[2], accounts[3]],
      [toSend1, toSend2, toSendTooMuch]
      ))
      .to.be.reverted;

    // Pay from accounts[0] to [1], [2] and [3] in one transaction
    await paymentHub.connect(owner).multiPay(
      config.baseCurrencyAddress,
      [accounts[1], accounts[2], accounts[3]],
      [toSend1, toSend2, toSend3]
    );

    // Get balances after
    const balanceAfter0 = await base.balanceOf(accounts[0]);
    const balanceAfter1 = await base.balanceOf(accounts[1]);
    const balanceAfter2 = await base.balanceOf(accounts[2]);
    const balanceAfter3 = await base.balanceOf(accounts[3]);

    // Check result
    expect(balanceBefore0.sub(toSend1).sub(toSend2).sub(toSend3)).to.eq(balanceAfter0);
    expect(balanceBefore1.add(toSend1)).to.eq(balanceAfter1);
    expect(balanceBefore2.add(toSend2)).to.eq(balanceAfter2);
    expect(balanceBefore3.add(toSend3)).to.eq(balanceAfter3);
  });
});
