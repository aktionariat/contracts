/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const BN = require("bn.js");
const Chance = require("chance");
const truffleAssert = require("truffle-assertions");
const { artifacts, getNamedAccounts, getUnnamedAccounts} = require("hardhat");

// Import contracts to be tested
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const PaymentHub = artifacts.require("PaymentHub");
const Brokerbot = artifacts.require("Brokerbot");

// Contract hardcoded variables
const BUYING_ENABLED = 0x1;
const SELLING_ENABLED = 0x2;

contract("Brokerbot", () => {
  let accounts;
  let brokerbot;
  let paymentHub;
  let draggableShares;
  let deployer;

  before(async () => {
    const namedAcc = await getNamedAccounts();
    deployer = namedAcc.deployer;
    accounts =  await getUnnamedAccounts();
    brokerbot = await Brokerbot.deployed();
    paymentHub = await PaymentHub.deployed();
    draggableShares = await DraggableShares.deployed();
  });

  it("should deploy", async () => {
    assert(brokerbot.address !== "");
  });

  it("should get constructor params correctly", async () => {
    const baseCurrency = await brokerbot.base.call();
    const owner = await brokerbot.owner.call();
    const price = web3.utils.toBN(await brokerbot.getPrice());
    const increment = web3.utils.toBN(await brokerbot.increment.call());

    assert.equal(baseCurrency, config.baseCurrencyAddress);
    assert.equal(owner, deployer);
    assert.equal(price, config.sharePrice);
    assert(increment.isZero());
  });

  it("should calculate buy price correctly - no increment - no drift", async () => {
    // Used Contract: Brokerbot
    // Initialize
    await brokerbot.setPrice(config.sharePrice, new BN(0));

    // 0 cost for 0 shares
    const priceZeroShares = await brokerbot.getBuyPrice(new BN(0));
    assert(priceZeroShares.isZero());

    // getPrice cost for 1 share
    const priceOneShare = await brokerbot.getBuyPrice(new BN(1));
    const quotePrice = await brokerbot.getPrice();
    assert(priceOneShare.eq(quotePrice));

    // Do 100 times with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = new BN(
        new Chance().natural({ min: 2, max: 50000 })
      );
      const priceRandomNumberShares = await brokerbot.getBuyPrice(
        randomNumberShares
      );
      assert(priceOneShare.mul(randomNumberShares).eq(priceRandomNumberShares));
    }
  });

  it("should calculate sell price correctly - no increment - no drift", async () => {
    // Used Contract: Brokerbot
    // Initialize
    await brokerbot.setPrice(config.sharePrice, new BN(0));

    // 0 cost for 0 shares
    const priceZeroShares = await brokerbot.getSellPrice(new BN(0));
    assert(priceZeroShares.isZero());

    // getPrice cost for 1 share
    const priceOneShare = await brokerbot.getSellPrice(new BN(1));
    const quotePrice = await brokerbot.getPrice();
    assert(priceOneShare.eq(quotePrice));

    // Do 100 times with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = new BN(
        new Chance().natural({ min: 2, max: 50000 })
      );
      const priceRandomNumberShares = await brokerbot.getSellPrice(
        randomNumberShares
      );
      assert(priceOneShare.mul(randomNumberShares).eq(priceRandomNumberShares));
    }
  });

  it("should set increment correctly (0.001 per share)", async () => {
    // Used Contract: Brokerbot
    // Get existing and reset while incrementing by delta
    const price = await brokerbot.getPrice();
    const incrementBefore = await brokerbot.increment.call();
    const delta = new BN("1000000000000000");
    await brokerbot.setPrice(price, incrementBefore.add(delta));
    const incrementAfter = await brokerbot.increment.call();

    // Check result
    assert(incrementBefore.add(delta).eq(incrementAfter));
  });

  it("should calculate buy price correctly - with increment - no drift", async () => {
    // Used Contract: Brokerbot
    // Initialize with random increment
    const increment = web3.utils.toWei(
      new BN(new Chance().integer({ min: 1, max: 1000 })),
      "milli"
    );
    await brokerbot.setPrice(config.sharePrice, increment);

    // 0 cost for 0 shares
    const priceZeroShares = await brokerbot.getBuyPrice(new BN(0));
    assert(priceZeroShares.isZero());

    // getPrice cost for 1 share
    const priceOneShare = await brokerbot.getBuyPrice(new BN(1));
    const quotePrice = await brokerbot.getPrice();
    assert(priceOneShare.eq(quotePrice));

    // Do 10 times with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = new BN(
        new Chance().natural({ min: 2, max: 50000 })
      );
      // Get price from contract
      const priceRandomNumberShares = await brokerbot.getBuyPrice(
        randomNumberShares
      );

      // Calculate the most straightforward way
      let calculatedPrice = new BN(0);
      let priceForShare = priceOneShare;
      for (let share = 0; share < randomNumberShares; share++) {
        calculatedPrice = calculatedPrice.add(priceForShare);
        priceForShare = priceForShare.add(increment);
      }

      // Check result
      assert(priceRandomNumberShares.eq(calculatedPrice));
    }
  });

  it("should calculate sell price correctly - with increment - no drift", async () => {
    // Used Contract: Brokerbot
    // Initialize with random increment
    const increment = web3.utils.toWei(
      new BN(new Chance().integer({ min: 1, max: 10000 })),
      "gwei"
    );
    await brokerbot.setPrice(config.sharePrice, increment);

    // 0 cost for 0 shares
    const priceZeroShares = await brokerbot.getSellPrice(new BN(0));
    assert(priceZeroShares.isZero());

    // getPrice cost for 1 share
    const priceOneShare = await brokerbot.getSellPrice(new BN(1));
    const quotePrice = await brokerbot.getPrice();
    assert(priceOneShare.eq(quotePrice.sub(increment)));

    // Do 10 times with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = new BN(
        new Chance().natural({ min: 2, max: 50000 })
      );
      // Get price from contract
      const priceRandomNumberShares = await brokerbot.getSellPrice(
        randomNumberShares
      );

      // Calculate the most straightforward way
      let calculatedPrice = new BN(0);
      let priceForShare = priceOneShare;
      for (let share = 0; share < randomNumberShares; share++) {
        calculatedPrice = calculatedPrice.add(priceForShare);
        priceForShare = priceForShare.sub(increment);
      }

      // Check result
      assert(priceRandomNumberShares.eq(calculatedPrice));
    }
  });

  it("should calculate number of shares for given baseCurrency amount sent (getShares)", async () => {
    // Used Contract: Brokerbot
    // Set random price and increment
    const price = web3.utils.toWei(
      new BN(new Chance().integer({ min: 1000, max: 10000 })),
      "milli"
    );
    const increment = web3.utils.toWei(
      new BN(new Chance().integer({ min: 1, max: 1000 })),
      "milli"
    );
    await brokerbot.setPrice(price, increment);

    // No payment no shares
    const sharesZeroPaid = await brokerbot.getShares(new BN(0));
    assert(sharesZeroPaid.isZero());

    // Sent payment worth 1 share
    const singlePrice = await brokerbot.getBuyPrice(new BN(1));
    const sharesSinglePaid = await brokerbot.getShares(singlePrice);
    assert(sharesSinglePaid.eq(new BN(1)));

    // Repeat with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = new BN(
        new Chance().natural({ min: 2, max: 50000 })
      );
      const priceRandomNumberShares = await brokerbot.getBuyPrice(
        randomNumberShares
      );
      const calculatedShares = await brokerbot.getShares(priceRandomNumberShares);
      assert(calculatedShares.eq(randomNumberShares));
    }
  });

  it("should allow enabling/disabling buying/selling.", async () => {
    // Used Contract: Brokerbot
    await brokerbot.setSettings(BUYING_ENABLED);
    assert(await brokerbot.buyingEnabled());
    assert(!(await brokerbot.sellingEnabled()));

    await brokerbot.setSettings(SELLING_ENABLED);
    assert(!(await brokerbot.buyingEnabled()));
    assert(await brokerbot.sellingEnabled());

    await brokerbot.setSettings(BUYING_ENABLED | SELLING_ENABLED);
    assert(await brokerbot.buyingEnabled());
    assert(await brokerbot.sellingEnabled());

    await brokerbot.setSettings("0x0");
    assert(!(await brokerbot.buyingEnabled()));
    assert(!(await brokerbot.sellingEnabled()));
  });

  it("should not allow buying shares when buying is disabled", async () => {
    // Used Contract: Brokerbot, Payment Hub
    // Disable buying
    brokerbot.setSettings(SELLING_ENABLED);

    // Random number of shares to buy
    const sharesToBuy = new BN(new Chance().natural({ min: 1, max: 500 }));
    const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);
    const buyPriceInETH = await paymentHub.getPriceInEther.call(buyPrice, brokerbot.address);

    // Base payment should fail
    await truffleAssert.reverts(
      paymentHub.payAndNotify(brokerbot.address, buyPrice, "0x20", {
        from: accounts[0],
      })
    );

    // ETH payment should fail
    await truffleAssert.reverts(
      paymentHub.payFromEtherAndNotify(brokerbot.address, buyPrice, "0x20", {
        from: accounts[0],
        value: buyPriceInETH,
      })
    );
  });

  it("should not allow selling shares when selling is disabled", async () => {
    // Used Contract: Brokerbot, Payment Hub, Draggable Shares
    // Disable selling
    brokerbot.setSettings(BUYING_ENABLED);

    // Random number of shares to buy
    const sharesToSell = new BN(new Chance().natural({ min: 1, max: 500 }));

    // Base payment should fail
    await truffleAssert.reverts(
      paymentHub.methods["payAndNotify(address,address,uint256,bytes)"](
        draggableShares.address,
        brokerbot.address,
        sharesToSell,
        "0x20",
        { from: accounts[0] }
      )
    );
  });

  it("should be able to distribute shares to multiple shareholders", async () => {
    // Used Contract: Brokerbot, Draggable Shares
    const buyers = [
      "0xae7eedf49d6c7a777452ee5927e5f8cacd82253b",
      "0xae7eedf49d6c7a777452ee5927e5f8cacd82253b",
      "0xedd9e0b4b1b8a34dd3c90265dd5ed1b93099f178",
      "0x7428a69ecbe26b8d5bfc7d6353fcc71de26e4ed8",
      "0x2f0494ffbdaff332db336dbe8b3ce3c1a049e76a",
      "0x7af19e35b824a88c7fe8241b560a2e278b569af4",
      "0xedd9e0b4b1b8a34dd3c90265dd5ed1b93099f178",
      "0xd9de2e130b6d1d3871a1f2b5301c542542e76063",
      "0x99c4704b59b4d3072d388b17f5e99c27d1d29a4d",
      "0x0df9225bd4fb0cce596d41becbc9b2c116233fb2",
      "0xc4f78b740c7c0cf78670b341487bbe285de2fb7f",
      "0xc4f78b740c7c0cf78670b341487bbe285de2fb7f",
      "0x8824ba7d8e47aab3d04e7f9dcbb456334fd029f6",
      "0xe8fdcee492e7cecce00c0a34fac38cc41679cd8a",
      "0xb866480b21eb64d2b6e2fd710ba3667ab01b2e2e",
      "0xb866480b21eb64d2b6e2fd710ba3667ab01b2e2e",
    ];
    const shares = [
      50, 20, 10, 450, 50, 10, 12, 50, 20, 12, 10, 10, 10, 50, 50, 50,
    ];
    const ref = [
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
      "0x",
    ];

    const brokerbotBalanceBefore = await draggableShares.balanceOf(
      brokerbot.address
    );
    const buyerBalancesBefore = await Promise.all(
      buyers.map(async (address) => {
        return await draggableShares.balanceOf(address);
      })
    );

    await brokerbot.notifyTradesAndTransfer(buyers, shares, ref);

    const brokerbotBalanceAfter = await draggableShares.balanceOf(
      brokerbot.address
    );
    const buyerBalancesAfter = await Promise.all(
      buyers.map(async (address) => {
        return await draggableShares.balanceOf(address);
      })
    );

    // Check result. Double loop, because an address can have multiple allocations i
    for (let i = 0; i < buyers.length; i++) {
      let balance = buyerBalancesBefore[i];
      for (let j = 0; j < buyers.length; j++) {
        if (buyers[i] === buyers[j]) {
          balance = balance.add(new BN(shares[j]));
        }
      }
      assert(balance.eq(buyerBalancesAfter[i]));
    }

    const totalShares = shares.reduce((a, b) => a + b, 0);
    assert(
      brokerbotBalanceBefore.sub(new BN(totalShares)).eq(brokerbotBalanceAfter)
    );
  });

  /*
  // Temporarily disabled - Current Brokerbot doesn't have notifyTrade methods

  it('should support external trades', async () => {
    // Used Contract: Brokerbot
    let brokerbot = await Brokerbot.deployed();
    let draggableShares = await DraggableShares.deployed();

    // Initialize with random increment
    let increment = web3.utils.toWei(new BN(new Chance().integer({ min: 1, max: 1000 })), 'milli');
    await brokerbot.setPrice(config.sharePrice, increment);

    let balanceBefore = await draggableShares.balanceOf(brokerbot.address);
    let price1 = await brokerbot.getBuyPrice(new BN(1));
    await brokerbot.notifyTrade(accounts[0], 700, "0x");
    await brokerbot.notifyTradeAndTransfer(accounts[0], 300, "0x");
    let price2 = await brokerbot.getBuyPrice(new BN(1));
    let balanceAfter = await draggableShares.balanceOf(brokerbot.address);

    assert(price1.add(increment.mul(new BN(1000))).eq(price2));
    assert(balanceAfter.add(new BN(300)).eq(balanceBefore));
  })

  it('should allow buying shares with BaseCurrency', async () => {
    let brokerbot = await Brokerbot.deployed();
    await brokerbot.onTokenTransfer(accounts[0], )
    
  })

  it('should allow selling shares against BaseCurrency', async () => {
    
  })
  */
});
