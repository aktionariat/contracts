// Shared Config
const config = require("../scripts/deploy_config_mainnet.js");

// Libraries
const { ethers} = require("hardhat");
const { expect } = require("chai");
const { setup } = require("./helper/index");

// Test parameters
const paymentAmountInBase = ethers.parseEther("10");

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
  // xchf - dchf - usdc - weth
  const types = ["address","uint24","address","uint24","address","uint24","address"];
  const values = [config.baseCurrencyAddress, 100, config.dchfAddress, 500, config.usdcAddress, 500, config.wethAddress];
  const pathBaseWeth = ethers.solidityPacked(types,values);

  before( async () => {
    [deployer,owner,sig1,sig2,sig3] = await ethers.getSigners();
    accounts = [owner.address,sig1.address,sig2.address,sig3.address];
    // deploy contracts
    await setup(true);

    paymentHub = await ethers.getContract("PaymentHub");
    brokerbot = await ethers.getContract("Brokerbot");
    base = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  });

  it("should deploy paymenthub", async () => {
    expect(await paymentHub.getAddress()).to.exist;
  });

  it("should get price in ether", async () => {
    const priceInETH = await paymentHub.getPriceInEther.staticCall(paymentAmountInBase, await brokerbot.getAddress(), pathBaseWeth);
    expect(priceInETH).to.be.above(0n);
  });

  it("should pay using Ether to recipient in baseCurrency", async () => {
    // Used contracts: PaymentHub, Base

    // Get balances before
    const ethBalanceSenderBefore = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientBefore = await base.balanceOf(accounts[1]);

    // Execute payment
    //const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](paymentAmountInBase, await brokerbot.getAddress());
    const priceInETH = await paymentHub.getPriceInEther.staticCall(paymentAmountInBase, await brokerbot.getAddress(), pathBaseWeth);
    const txInfo = await paymentHub.connect(owner).payFromEther(
      accounts[1],
      paymentAmountInBase,
      pathBaseWeth,
      { value: priceInETH }
    );
    const { gasPrice, cumulativeGasUsed} = await txInfo.wait();
    const gasCost = gasPrice * cumulativeGasUsed;

    // Get balances after
    const ethBalanceSenderAfter = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientAfter = await base.balanceOf(accounts[1]);

    // Check result
    expect(ethBalanceSenderBefore - priceInETH - gasCost).to.equal(ethBalanceSenderAfter);
    expect(baseBalanceRecipientBefore + paymentAmountInBase).to.equal(baseBalanceRecipientAfter);
  });

  it("should return unspent ETH to spender", async () => {
    // Used contracts: PaymentHub, Base
    // Get balances before
    const ethBalanceSenderBefore = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientBefore = await base.balanceOf(accounts[1]);

    // Calculate required ETH and set a slippage
    const priceInETH = await paymentHub.getPriceInEther.staticCall(paymentAmountInBase, await brokerbot.getAddress(), pathBaseWeth);
    const priceInEthWithSlippage = priceInETH * 103n / 100n;

    // Execute transaction with increased ETH
    const txInfo = await paymentHub.connect(owner).payFromEther(
      accounts[1],
      paymentAmountInBase,
      pathBaseWeth,
      { value: priceInEthWithSlippage }
    );
    const { gasPrice, cumulativeGasUsed} = await txInfo.wait();
    const gasCost = gasPrice * cumulativeGasUsed;

    // Get balances after
    const ethBalanceSenderAfter = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceRecipientAfter = await base.balanceOf(accounts[1]);
    const ethBalancePaymentHubAfter = await ethers.provider.getBalance(await paymentHub.getAddress());
    const ethBalanceUniswapAfter = await ethers.provider.getBalance(config.uniswapRouterAddress);

    // Check result
    expect(ethBalanceSenderBefore - priceInETH - gasCost).to.eq(ethBalanceSenderAfter);
    expect(baseBalanceRecipientBefore + paymentAmountInBase).to.eq(baseBalanceRecipientAfter);
    expect(ethBalancePaymentHubAfter).to.equal(0n);
    expect(ethBalanceUniswapAfter).to.equal(0n);
  });

  it("should make multiple payments in baseCurrency in single transaction", async () => {
    // Used contracts: PaymentHub, base

    // Get 1/100 of accounts[0] token balance. Send 1, 3, 20 units to accounts[1],[2],[3] respectively.
    const balance = await base.balanceOf(accounts[0]);
    const toSendUnit = balance / 100n;
    const toSend1 = toSendUnit * 1n;
    const toSend2 = toSendUnit * 3n;
    const toSend3 = toSendUnit * 20n;

    // get amount that is higher than account balance
    const toSendTooMuch = toSendUnit * 110n;

    // Set allowance for paymentHub to spend baseCurrency tokens of account[0]
    await base.connect(owner).approve(await paymentHub.getAddress(), config.infiniteAllowance);

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
    expect(balanceBefore0 - toSend1 - toSend2 - toSend3).to.eq(balanceAfter0);
    expect(balanceBefore1 + toSend1).to.eq(balanceAfter1);
    expect(balanceBefore2 + toSend2).to.eq(balanceAfter2);
    expect(balanceBefore3 + toSend3).to.eq(balanceAfter3);
  });
});
