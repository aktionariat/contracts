/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");
const Chance = require("chance");

const {getUnnamedAccounts} = require("hardhat");

// Import contracts to be tested
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const PaymentHub = artifacts.require("PaymentHub");
const Brokerbot = artifacts.require("Brokerbot");
const ERC20 = artifacts.require("ERC20Basic");

contract("Payment Integration", () => {
  let accounts;

  before(async () => {
    accounts =  await getUnnamedAccounts();
  });
  it("should allow buying shares by sending baseCurrency through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub
    const brokerbot = await Brokerbot.deployed();
    const draggableShares = await DraggableShares.deployed();
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    const paymentHub = await PaymentHub.deployed();

    // Random number of shares to buy
    const sharesToBuy = new BN(new Chance().natural({ min: 2, max: 500 }));
    const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);

    // Balance before
    const baseBalanceSenderBefore = await erc20.balanceOf(accounts[0]);
    const baseBalanceBrokerbotBefore = await erc20.balanceOf(brokerbot.address);
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Pay with base currency and notify Brokerbot
    await paymentHub.payAndNotify(brokerbot.address, buyPrice, "0x20", {
      from: accounts[0],
    });

    // Balance after
    const baseBalanceSenderAfter = await erc20.balanceOf(accounts[0]);
    const baseBalanceBrokerbotAfter = await erc20.balanceOf(brokerbot.address);
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Check Results
    assert(baseBalanceSenderBefore.sub(buyPrice).eq(baseBalanceSenderAfter));
    assert(
      baseBalanceBrokerbotBefore.add(buyPrice).eq(baseBalanceBrokerbotAfter)
    );
    assert(
      shareBalanceSenderBefore.add(sharesToBuy).eq(shareBalanceSenderAfter)
    );
    assert(
      shareBalanceBrokerbotBefore
        .sub(sharesToBuy)
        .eq(shareBalanceBrokerbotAfter)
    );
  });

  it("should allow buying shares by sending ETH through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub
    const brokerbot = await Brokerbot.deployed();
    const draggableShares = await DraggableShares.deployed();
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    const paymentHub = await PaymentHub.deployed();

    // Random number of shares to buy
    const sharesToBuy = new BN(new Chance().natural({ min: 1, max: 500 }));
    const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);
    const buyPriceInETH = await paymentHub.getPriceInEther.call(buyPrice,  brokerbot.address);

    // Balance before
    const balanceSenderBefore = new BN(await web3.eth.getBalance(accounts[0]));
    const baseBalanceBrokerbotBefore = await erc20.balanceOf(brokerbot.address);
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Pay with base currency and notify Brokerbot. Also get gas cost.
    const txInfo = await paymentHub.payFromEtherAndNotify(
      brokerbot.address,
      buyPrice,
      "0x20",
      { from: accounts[0], value: buyPriceInETH }
    );
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasCost = new BN(tx.gasPrice).mul(new BN(txInfo.receipt.gasUsed));

    // Balance after
    const balanceSenderAfter = new BN(await web3.eth.getBalance(accounts[0]));
    const baseBalanceBrokerbotAfter = await erc20.balanceOf(brokerbot.address);
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Check Results
    assert(
      balanceSenderBefore.sub(buyPriceInETH).sub(gasCost).eq(balanceSenderAfter)
    );
    assert(
      baseBalanceBrokerbotBefore.add(buyPrice).eq(baseBalanceBrokerbotAfter)
    );
    assert(
      shareBalanceSenderBefore.add(sharesToBuy).eq(shareBalanceSenderAfter)
    );
    assert(
      shareBalanceBrokerbotBefore
        .sub(sharesToBuy)
        .eq(shareBalanceBrokerbotAfter)
    );
  });

  /*
  it('should allow selling by sending share tokens through PaymentHub - no license fee', async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub
    let brokerbot = await Brokerbot.deployed();
    let draggableShares = await DraggableShares.deployed();
    let erc20 = await ERC20.at(config.baseCurrencyAddress);
    let paymentHub = await PaymentHub.deployed();

    // Disable license fee
    await brokerbot.setLicenseFee(new BN(0), { from: config.brokerbotCopyrightOwnerAddress });
    
    // Random number of shares to sell
    var sharesToSell = new BN(new Chance().natural({ min: 2, max: 500 }));
    let sellPrice = await brokerbot.getSellPrice(sharesToSell);

    // Balance before
    let baseBalanceSenderBefore = await erc20.balanceOf(accounts[0]);
    let baseBalanceBrokerbotBefore = await erc20.balanceOf(brokerbot.address);
    let shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    let shareBalanceBrokerbotBefore = await draggableShares.balanceOf(brokerbot.address);

    // Pay with base currency and notify Brokerbot
    // Overloaded methods must be called through .methods[], otherwise Truffle doesn't recognize them
    await paymentHub.methods["payAndNotify(address,address,uint256,bytes)"](draggableShares.address, brokerbot.address, sharesToSell, "0x20", { from: accounts[0] });

    // Balance after
    let baseBalanceSenderAfter = await erc20.balanceOf(accounts[0]);
    let baseBalanceBrokerbotAfter = await erc20.balanceOf(brokerbot.address);
    let shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    let shareBalanceBrokerbotAfter = await draggableShares.balanceOf(brokerbot.address);
    
    // Check Results
    assert(baseBalanceSenderBefore.add(sellPrice).eq(baseBalanceSenderAfter))
    assert(baseBalanceBrokerbotBefore.sub(sellPrice).eq(baseBalanceBrokerbotAfter));
    assert(shareBalanceBrokerbotBefore.add(sharesToSell).eq(shareBalanceBrokerbotAfter))
    assert(shareBalanceSenderBefore.sub(sharesToSell).eq(shareBalanceSenderAfter));
  })
  */

  it("should allow selling by sending share tokens through PaymentHub - with license fee", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub
    const brokerbot = await Brokerbot.deployed();
    const draggableShares = await DraggableShares.deployed();
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    const paymentHub = await PaymentHub.deployed();

    // Get license fee (90 bps default)
    //const licenseFeeBps = await brokerbot.getLicenseFee(10000);

    // Random number of shares to sell
    const sharesToSell = new BN(new Chance().natural({ min: 1, max: 500 }));
    const sellPrice = await brokerbot.getSellPrice(sharesToSell);

    // Calculate total fee for transaction
    const totalFee = await brokerbot.getLicenseFee(sellPrice);;

    // Balance before
    const baseBalanceSenderBefore = await erc20.balanceOf(accounts[0]);
    const baseBalanceBrokerbotBefore = await erc20.balanceOf(brokerbot.address);
    const baseBalanceCopyrightBefore = await erc20.balanceOf(
      config.brokerbotCopyrightOwnerAddress
    );
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      brokerbot.address
    );

    // approve sending draggableShares to sell
    await draggableShares.approve(paymentHub.address, sharesToSell, { from: accounts[0] });

    // Pay with base currency and notify Brokerbot
    // Overloaded methods must be called through .methods[], otherwise Truffle doesn't recognize them
    await paymentHub.methods["payAndNotify(address,address,uint256,bytes)"](
      draggableShares.address,
      brokerbot.address,
      sharesToSell,
      "0x01",
      { from: accounts[0] }
    );

    // Balance after
    const baseBalanceSenderAfter = await erc20.balanceOf(accounts[0]);
    const baseBalanceBrokerbotAfter = await erc20.balanceOf(brokerbot.address);
    const baseBalanceCopyrightAfter = await erc20.balanceOf(
      config.brokerbotCopyrightOwnerAddress
    );
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Check Results
    assert(
      baseBalanceSenderBefore
        .add(sellPrice)
        .sub(totalFee)
        .eq(baseBalanceSenderAfter)
    );
    assert(
      baseBalanceBrokerbotBefore.sub(sellPrice).eq(baseBalanceBrokerbotAfter)
    );
    assert(
      baseBalanceCopyrightBefore.add(totalFee).eq(baseBalanceCopyrightAfter)
    );
    assert(
      shareBalanceBrokerbotBefore
        .add(sharesToSell)
        .eq(shareBalanceBrokerbotAfter)
    );
    assert(
      shareBalanceSenderBefore.sub(sharesToSell).eq(shareBalanceSenderAfter)
    );
  });
});
