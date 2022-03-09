/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config.js");

const { setup } = require("./helper/index");

// Libraries
const Chance = require("chance");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import contracts to be tested

describe("Payment Integration", () => {
  let accounts;
  let brokerbot;
  let paymentHub;
  let draggableShares;
  let baseCurrency;

  let owner;
  before(async () => {
    //setup();

    [deployer,owner,] = await ethers.getSigners();
    accounts = [owner.address];

    paymentHub = await ethers.getContract("PaymentHub");
    brokerbot = await ethers.getContract("Brokerbot");
    draggableShares = await ethers.getContract("DraggableShares");

    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);
  });
  it("should allow buying shares by sending baseCurrency through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub

    // Random number of shares to buy
    const sharesToBuy = new Chance().natural({ min: 2, max: 500 });
    const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);

    // Balance before
    const baseBalanceSenderBefore = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(brokerbot.address);
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Pay with base currency and notify Brokerbot
    await paymentHub.connect(owner)["payAndNotify(address,uint256,bytes)"](brokerbot.address, buyPrice, "0x20");

    // Balance after
    const baseBalanceSenderAfter = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(brokerbot.address);
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(brokerbot.address);

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

    // Random number of shares to buy
    const sharesToBuy = new Chance().natural({ min: 1, max: 500 });
    const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);
    const buyPriceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](buyPrice,  brokerbot.address);

    // Balance before
    const balanceSenderBefore = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(brokerbot.address);
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      brokerbot.address
    );

    // Pay with base currency and notify Brokerbot. Also get gas cost.
    const txInfo = await paymentHub.connect(owner).payFromEtherAndNotify(
      brokerbot.address,
      buyPrice,
      "0x20",
      { value: buyPriceInETH }
    );
    const { effectiveGasPrice, cumulativeGasUsed} = await txInfo.wait();
    const gasCost = effectiveGasPrice.mul(cumulativeGasUsed);

    // Balance after
    const balanceSenderAfter = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(brokerbot.address);
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

    // Disable license fee
    await brokerbot.setLicenseFee(new BN(0), { from: config.brokerbotCopyrightOwnerAddress });
    
    // Random number of shares to sell
    var sharesToSell = new BN(new Chance().natural({ min: 2, max: 500 }));
    let sellPrice = await brokerbot.getSellPrice(sharesToSell);

    // Balance before
    let baseBalanceSenderBefore = await baseCurrency.balanceOf(accounts[0]);
    let baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(brokerbot.address);
    let shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    let shareBalanceBrokerbotBefore = await draggableShares.balanceOf(brokerbot.address);

    // Pay with base currency and notify Brokerbot
    // Overloaded methods must be called through .methods[], otherwise Truffle doesn't recognize them
    await paymentHub.methods["payAndNotify(address,address,uint256,bytes)"](draggableShares.address, brokerbot.address, sharesToSell, "0x20", { from: accounts[0] });

    // Balance after
    let baseBalanceSenderAfter = await baseCurrency.balanceOf(accounts[0]);
    let baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(brokerbot.address);
    let shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    let shareBalanceBrokerbotAfter = await draggableShares.balanceOf(brokerbot.address);
    
    // Check Results
    assert(baseBalanceSenderBefore.add(sellPrice).eq(baseBalanceSenderAfter))
    assert(baseBalanceBrokerbotBefore.sub(sellPrice).eq(baseBalanceBrokerbotAfter));
    assert(shareBalanceBrokerbotBefore.add(sharesToSell).eq(shareBalanceBrokerbotAfter))
    assert(shareBalanceSenderBefore.sub(sharesToSell).eq(shareBalanceSenderAfter));
  })
  */

  it("should allow selling by sending share tokens through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub


    // Random number of shares to sell
    const sharesToSell = new Chance().natural({ min: 1, max: 500 });
    const sellPrice = await brokerbot.getSellPrice(sharesToSell);

    // Balance before
    const baseBalanceSenderBefore = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(brokerbot.address);
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      brokerbot.address
    );

    // approve sending draggableShares to sell
    await draggableShares.connect(owner).approve(paymentHub.address, sharesToSell);

    // Pay with base currency and notify Brokerbot
    // Overloaded methods must be called through .methods[], otherwise Truffle doesn't recognize them
    await paymentHub.connect(owner)["payAndNotify(address,address,uint256,bytes)"](
      draggableShares.address,
      brokerbot.address,
      sharesToSell,
      "0x01"
    );

    // Balance after
    const baseBalanceSenderAfter = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(brokerbot.address);
    const baseBalanceCopyrightAfter = await baseCurrency.balanceOf(
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
        .eq(baseBalanceSenderAfter)
    );
    assert(
      baseBalanceBrokerbotBefore.sub(sellPrice).eq(baseBalanceBrokerbotAfter)
    )
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
