/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config_mainnet.js");

const { setup, randomBigInt } = require("./helper/index");

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

  let sharesToBuy;
  let buyPrice;

  let owner;
  before(async () => {
    await setup(true);

    [deployer,owner,] = await ethers.getSigners();
    accounts = [owner.address];

    paymentHub = await ethers.getContract("PaymentHub");
    brokerbot = await ethers.getContract("Brokerbot");
    draggableShares = await ethers.getContract("DraggableShares");

    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  });
  beforeEach(async () => {
     // Random number of shares to buy
     sharesToBuy = randomBigInt(2, 500);
     buyPrice = await brokerbot.getBuyPrice(sharesToBuy);
  });
  it("should allow buying shares by sending baseCurrency through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub

    // Balance before
    const baseBalanceSenderBefore = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(
      await brokerbot.getAddress()
    );

    // Pay with base currency and notify Brokerbot
    await paymentHub.connect(owner)["payAndNotify(address,uint256,bytes)"](await brokerbot.getAddress(), buyPrice, "0x20");

    // Balance after
    const baseBalanceSenderAfter = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(await brokerbot.getAddress());

    // Check Results
    expect(baseBalanceSenderBefore - buyPrice).to.equal(baseBalanceSenderAfter);
    expect(baseBalanceBrokerbotBefore + buyPrice).to.equal(baseBalanceBrokerbotAfter);
    expect(shareBalanceSenderBefore + sharesToBuy).to.equal(shareBalanceSenderAfter);
    expect(shareBalanceBrokerbotBefore - sharesToBuy).to.equal(shareBalanceBrokerbotAfter);
   });

  it("should allow buying shares by sending ETH through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub
    const buyPriceInETH = await paymentHub.getPriceInEther.staticCall(buyPrice,  await brokerbot.getAddress());

    // Balance before
    const balanceSenderBefore = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(await brokerbot.getAddress());

    // Pay with base currency and notify Brokerbot. Also get gas cost.
    const txInfo = await paymentHub.connect(owner).payFromEtherAndNotify(
      await brokerbot.getAddress(),
      buyPrice,
      "0x20",
      { value: buyPriceInETH }
    );
    const { gasPrice, cumulativeGasUsed} = await txInfo.wait();
    const gasCost = gasPrice * cumulativeGasUsed;

    // Balance after
    const balanceSenderAfter = await ethers.provider.getBalance(accounts[0]);
    const baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(await brokerbot.getAddress());

    // Check Results
    expect(balanceSenderBefore - buyPriceInETH - gasCost).to.equal(balanceSenderAfter);
    expect(baseBalanceBrokerbotBefore + buyPrice).to.equal(baseBalanceBrokerbotAfter);
    expect(shareBalanceSenderBefore + sharesToBuy).to.equal(shareBalanceSenderAfter);
    expect(shareBalanceBrokerbotBefore - sharesToBuy).to.equal(shareBalanceBrokerbotAfter);
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
    let baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
    let shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    let shareBalanceBrokerbotBefore = await draggableShares.balanceOf(await brokerbot.getAddress());

    // Pay with base currency and notify Brokerbot
    // Overloaded methods must be called through .methods[], otherwise Truffle doesn't recognize them
    await paymentHub.methods["payAndNotify(address,address,uint256,bytes)"](await draggableShares.getAddress(), await brokerbot.getAddress(), sharesToSell, "0x20", { from: accounts[0] });

    // Balance after
    let baseBalanceSenderAfter = await baseCurrency.balanceOf(accounts[0]);
    let baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
    let shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    let shareBalanceBrokerbotAfter = await draggableShares.balanceOf(await brokerbot.getAddress());
    
    // Check Results
    expect(baseBalanceSenderBefore.add(sellPrice)).to.equal(baseBalanceSenderAfter);
    expect(baseBalanceBrokerbotBefore.sub(sellPrice)).to.equal(baseBalanceBrokerbotAfter);
    expect(shareBalanceBrokerbotBefore.add(sharesToSell)).to.equal(shareBalanceBrokerbotAfter);
    expect(shareBalanceSenderBefore.sub(sharesToSell)).to.equal(shareBalanceSenderAfter));
  })
  */

  it("should allow selling by sending share tokens through PaymentHub", async () => {
    // Used contracts: Brokerbot, PaymentHub, ERC20 Base Currency, DraggableShares
    // Transfer is not processed if token sender is not a known currency contract or PaymentHub


    // Random number of shares to sell
    const sharesToSell = randomBigInt(1, 500);
    const sellPrice = await brokerbot.getSellPrice(sharesToSell);

    // Balance before
    const baseBalanceSenderBefore = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
    const shareBalanceSenderBefore = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotBefore = await draggableShares.balanceOf(await brokerbot.getAddress());

    // approve sending draggableShares to sell
    await draggableShares.connect(owner).approve(await paymentHub.getAddress(), sharesToSell);

    // Pay with base currency and notify Brokerbot
    // Overloaded methods must be called through .methods[], otherwise Truffle doesn't recognize them
    await paymentHub.connect(owner)["payAndNotify(address,address,uint256,bytes)"](
      await draggableShares.getAddress(),
      await brokerbot.getAddress(),
      sharesToSell,
      "0x01"
    );

    // Balance after
    const baseBalanceSenderAfter = await baseCurrency.balanceOf(accounts[0]);
    const baseBalanceBrokerbotAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
    const shareBalanceSenderAfter = await draggableShares.balanceOf(accounts[0]);
    const shareBalanceBrokerbotAfter = await draggableShares.balanceOf(await brokerbot.getAddress());

    // Check Results
    expect(baseBalanceSenderBefore + sellPrice).to.equal(baseBalanceSenderAfter);
    expect(baseBalanceBrokerbotBefore - sellPrice).to.equal(baseBalanceBrokerbotAfter);
    expect(shareBalanceBrokerbotBefore + sharesToSell).to.equal(shareBalanceBrokerbotAfter);
    expect(shareBalanceSenderBefore - sharesToSell).to.equal(shareBalanceSenderAfter);
  });
});
