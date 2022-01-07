/* global artifacts, contract, assert, web3 */

// Shared Migration Config
const config = require("../migrations/migration_config");

// Libraries
const BN = require("bn.js");

// Import contracts to be tested
const PaymentHub = artifacts.require("PaymentHub");
const Brokerbot = artifacts.require("Brokerbot");
const ERC20 = artifacts.require("ERC20Basic");

// Test parameters
const paymentAmountInBase = new BN("1000000000000000");

contract("PaymentHub", (accounts) => {
  let paymentHub;
  let brokerbot;

  beforeEach(async () => {
    paymentHub = await PaymentHub.deployed();
    brokerbot = await Brokerbot.deployed();
  });
  it("should deploy", async () => {
    assert(paymentHub.address !== "");
  });

  it("should get price in ether", async () => {
    const priceInETH = await paymentHub.getPriceInEther.call(paymentAmountInBase, brokerbot.address);
    assert(priceInETH > 0);
  });

  it("should pay using Ether to recipient in baseCurrency", async () => {
    // Used contracts: PaymentHub, Base
    const base = await ERC20.at(config.baseCurrencyAddress);

    // Get balances before
    const ethBalanceSenderBefore = new BN(await web3.eth.getBalance(accounts[0]));
    const baseBalanceRecipientBefore = new BN(await base.balanceOf(accounts[1]));

    // Execute payment
    const priceInETH = await paymentHub.getPriceInEther.call(paymentAmountInBase, brokerbot.address);
    const txInfo = await paymentHub.payFromEther(
      accounts[1],
      paymentAmountInBase,
      await brokerbot.base(),
      { from: accounts[0], value: priceInETH }
    );
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasCost = new BN(tx.gasPrice).mul(new BN(txInfo.receipt.gasUsed));

    // Get balances after
    const ethBalanceSenderAfter = new BN(await web3.eth.getBalance(accounts[0]));
    const baseBalanceRecipientAfter = new BN(await base.balanceOf(accounts[1]));

    // Check result
    assert(
      ethBalanceSenderBefore
        .sub(priceInETH)
        .sub(gasCost)
        .eq(ethBalanceSenderAfter)
    );
    assert(
      baseBalanceRecipientBefore
        .add(paymentAmountInBase)
        .eq(baseBalanceRecipientAfter)
    );
  });

  it("should return unspent ETH to spender", async () => {
    // Used contracts: PaymentHub, Base
    const base = await ERC20.at(config.baseCurrencyAddress);

    // Get balances before
    const ethBalanceSenderBefore = new BN(await web3.eth.getBalance(accounts[0]));
    const baseBalanceRecipientBefore = new BN(await base.balanceOf(accounts[1]));

    // Calculate required ETH and set a slippage
    const priceInETH = new BN(
      await paymentHub.getPriceInEther.call(paymentAmountInBase, brokerbot.address)
    );
    const priceInEthWithSlippage = priceInETH.mul(new BN(103)).div(new BN(100));

    // Execute transaction with increased ETH
    const txInfo = await paymentHub.payFromEther(
      accounts[1],
      paymentAmountInBase,
      await brokerbot.base(),
      { from: accounts[0], value: priceInEthWithSlippage }
    );
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasCost = new BN(tx.gasPrice).mul(new BN(txInfo.receipt.gasUsed));

    // Get balances after
    const ethBalanceSenderAfter = new BN(await web3.eth.getBalance(accounts[0]));
    const baseBalanceRecipientAfter = new BN(await base.balanceOf(accounts[1]));
    const ethBalancePaymentHubAfter = new BN(
      await web3.eth.getBalance(paymentHub.address)
    );
    const ethBalanceUniswapAfter = new BN(
      await web3.eth.getBalance(config.uniswapRouterAddress)
    );

    // Check result
    assert(
      ethBalanceSenderBefore
        .sub(priceInETH)
        .sub(gasCost)
        .eq(ethBalanceSenderAfter)
    );
    assert(
      baseBalanceRecipientBefore
        .add(paymentAmountInBase)
        .eq(baseBalanceRecipientAfter)
    );
    assert(ethBalancePaymentHubAfter.isZero());
    assert(ethBalanceUniswapAfter.isZero());
  });

  it("should make multiple payments in baseCurrency in single transaction", async () => {
    // Used contracts: PaymentHub, Erc20
    const erc20 = await ERC20.at(config.baseCurrencyAddress);

    // Get 1/100 of accounts[0] token balance. Send 1, 3, 20 units to accounts[1],[2],[3] respectively.
    const balance = web3.utils.toBN(await erc20.balanceOf(accounts[0]));
    const toSendUnit = balance.div(new BN(100));
    const toSend1 = toSendUnit.mul(new BN(1));
    const toSend2 = toSendUnit.mul(new BN(3));
    const toSend3 = toSendUnit.mul(new BN(20));

    // Set allowance for paymentHub to spend baseCurrency tokens of account[0]
    await erc20.approve(paymentHub.address, new BN(config.infiniteAllowance));

    // Get balances before
    const balanceBefore0 = new BN(await erc20.balanceOf(accounts[0]));
    const balanceBefore1 = new BN(await erc20.balanceOf(accounts[1]));
    const balanceBefore2 = new BN(await erc20.balanceOf(accounts[2]));
    const balanceBefore3 = new BN(await erc20.balanceOf(accounts[3]));

    // Pay from accounts[0] to [1], [2] and [3] in one transaction
    await paymentHub.multiPay(
      config.baseCurrencyAddress,
      [accounts[1], accounts[2], accounts[3]],
      [toSend1, toSend2, toSend3],
      { from: accounts[0] }
    );

    // Get balances after
    const balanceAfter0 = new BN(await erc20.balanceOf(accounts[0]));
    const balanceAfter1 = new BN(await erc20.balanceOf(accounts[1]));
    const balanceAfter2 = new BN(await erc20.balanceOf(accounts[2]));
    const balanceAfter3 = new BN(await erc20.balanceOf(accounts[3]));

    // Check result
    assert(
      balanceBefore0.sub(toSend1).sub(toSend2).sub(toSend3).eq(balanceAfter0)
    );
    assert(balanceBefore1.add(toSend1).eq(balanceAfter1));
    assert(balanceBefore2.add(toSend2).eq(balanceAfter2));
    assert(balanceBefore3.add(toSend3).eq(balanceAfter3));
  });
});
