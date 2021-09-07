// Shared Migration Config
const config = require("../migrations/migration_config");

// Libraries
const BN = require('bn.js');

// Import contracts to be tested
const PaymentHub = artifacts.require("PaymentHub");
const ERC20 = artifacts.require("ERC20");

// Test parameters
const paymentAmountInBase = new BN("1000000000000000");

contract('PaymentHub', accounts => {
  it('should deploy', async () => {
    let paymentHub = await PaymentHub.deployed();
    assert(paymentHub.address !== '');
  })

  it('should have correct base currency set', async () => {
    let paymentHub = await PaymentHub.deployed();
    let currency = await paymentHub.currency.call();
    assert.equal(currency, config.baseCurrencyAddress);
  })

  it('should get price in ether', async () => {
    let paymentHub = await PaymentHub.deployed();
    let priceInETH = await paymentHub.getPriceInEther.call(paymentAmountInBase);
    assert(priceInETH > 0);
  })

  it('should pay using Ether to recipient in baseCurrency', async () => {
    // Used contracts: PaymentHub, Base
    let paymentHub = await PaymentHub.deployed();
    let base = await ERC20.at(config.baseCurrencyAddress);

    // Get balances before
    let ethBalanceSenderBefore = new BN(await web3.eth.getBalance(accounts[0]));
    let baseBalanceRecipientBefore = new BN(await base.balanceOf(accounts[1]));

    // Execute payment
    let priceInETH = await paymentHub.getPriceInEther.call(paymentAmountInBase);
    let txInfo = await paymentHub.payFromEther(accounts[1], paymentAmountInBase, { from: accounts[0], value: priceInETH });
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasCost = (new BN(tx.gasPrice)).mul(new BN(txInfo.receipt.gasUsed));

    // Get balances after
    let ethBalanceSenderAfter = new BN(await web3.eth.getBalance(accounts[0]));
    let baseBalanceRecipientAfter = new BN(await base.balanceOf(accounts[1]));

    // Check result
    assert(ethBalanceSenderBefore.sub(priceInETH).sub(gasCost).eq(ethBalanceSenderAfter));
    assert(baseBalanceRecipientBefore.add(paymentAmountInBase).eq(baseBalanceRecipientAfter));
  })

  it('should return unspent ETH to spender', async () => {
    // Used contracts: PaymentHub, Base
    let paymentHub = await PaymentHub.deployed();
    let base = await ERC20.at(config.baseCurrencyAddress);

    // Get balances before
    let ethBalanceSenderBefore = new BN(await web3.eth.getBalance(accounts[0]));
    let baseBalanceRecipientBefore = new BN(await base.balanceOf(accounts[1]));

    // Calculate required ETH and set a slippage
    let priceInETH = new BN(await paymentHub.getPriceInEther.call(paymentAmountInBase));
    let priceInEthWithSlippage = priceInETH.mul(new BN(103)).div(new BN(100))

    // Execute transaction with increased ETH
    let txInfo = await paymentHub.payFromEther(accounts[1], paymentAmountInBase, { from: accounts[0], value: priceInEthWithSlippage });
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasCost = (new BN(tx.gasPrice)).mul(new BN(txInfo.receipt.gasUsed));

    // Get balances after
    let ethBalanceSenderAfter = new BN(await web3.eth.getBalance(accounts[0]));
    let baseBalanceRecipientAfter = new BN(await base.balanceOf(accounts[1]));
    let ethBalancePaymentHubAfter = new BN(await web3.eth.getBalance(paymentHub.address));
    let ethBalanceUniswapAfter = new BN(await web3.eth.getBalance(config.uniswapRouterAddress));

    // Check result
    assert(ethBalanceSenderBefore.sub(priceInETH).sub(gasCost).eq(ethBalanceSenderAfter));
    assert(baseBalanceRecipientBefore.add(paymentAmountInBase).eq(baseBalanceRecipientAfter));
    assert(ethBalancePaymentHubAfter.isZero());
    assert(ethBalanceUniswapAfter.isZero());
  })

  it('should make multiple payments in baseCurrency in single transaction', async () => {
    // Used contracts: PaymentHub, Erc20
    let paymentHub = await PaymentHub.deployed();
    let erc20 = await ERC20.at(config.baseCurrencyAddress);

    // Get 1/100 of accounts[0] token balance. Send 1, 3, 20 units to accounts[1],[2],[3] respectively.
    let balance = web3.utils.toBN(await erc20.balanceOf(accounts[0]));
    let toSendUnit = balance.div(new BN(100));
    let toSend1 = toSendUnit.mul(new BN(1));
    let toSend2 = toSendUnit.mul(new BN(3));
    let toSend3 = toSendUnit.mul(new BN(20));

    // Set allowance for paymentHub to spend baseCurrency tokens of account[0]
    await erc20.approve(paymentHub.address, new BN(config.infiniteAllowance));

    // Get balances before
    let balanceBefore0 = new BN(await erc20.balanceOf(accounts[0]));
    let balanceBefore1 = new BN(await erc20.balanceOf(accounts[1]));
    let balanceBefore2 = new BN(await erc20.balanceOf(accounts[2]));
    let balanceBefore3 = new BN(await erc20.balanceOf(accounts[3]));

    // Pay from accounts[0] to [1], [2] and [3] in one transaction
    await paymentHub.multiPay(config.baseCurrencyAddress, [accounts[1], accounts[2], accounts[3]], [toSend1, toSend2, toSend3], { from: accounts[0] });

    // Get balances after
    let balanceAfter0 = new BN(await erc20.balanceOf(accounts[0]));
    let balanceAfter1 = new BN(await erc20.balanceOf(accounts[1]));
    let balanceAfter2 = new BN(await erc20.balanceOf(accounts[2]));
    let balanceAfter3 = new BN(await erc20.balanceOf(accounts[3]));

    // Check result
    assert(balanceBefore0.sub(toSend1).sub(toSend2).sub(toSend3).eq(balanceAfter0));
    assert(balanceBefore1.add(toSend1).eq(balanceAfter1));
    assert(balanceBefore2.add(toSend2).eq(balanceAfter2));
    assert(balanceBefore3.add(toSend3).eq(balanceAfter3));
  })
  
})