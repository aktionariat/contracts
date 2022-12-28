/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config_optimism.js");

// Libraries
const Chance = require("chance");
const { ethers } = require("hardhat");
const { buyingEnabled, sellingEnabled, setup } = require("./helper/index");
const { expect } = require("chai");
const exp = require("constants");

// Contract hardcoded variables
const BUYING_ENABLED = 0x1;
const SELLING_ENABLED = 0x2;

describe("Brokerbot", () => {
  let accounts;
  let brokerbot;
  let paymentHub;
  let draggableShares;
  let deployer;
  let owner;
  let sig1;

  before(async () => {
    [deployer,owner,sig1] = await ethers.getSigners();
    accounts = [owner.address,sig1.address];
    // deploy contracts
    await setup();

    //get references
    paymentHub = await ethers.getContract("PaymentHub");
    draggableShares = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  });

  describe("init", () => {
    it("should deploy", async () => {
      expect(brokerbot.address).to.exist;
    });
    
    it("should get constructor params correctly", async () => {
      const baseCurrency = await brokerbot.base();
      const brokerbotOwner = await brokerbot.owner();
      const price = await brokerbot.getPrice();
      const increment = await brokerbot.increment();
      
      expect(baseCurrency).to.equal(config.baseCurrencyAddress);
      expect(brokerbotOwner).to.equal(owner.address);
      expect(await price.toString()).to.equal(config.sharePrice);
      expect(increment.isZero()).to.eq(true);
    });
  });

  describe("calculate price", () => {
    beforeEach(async () => {
      await brokerbot.connect(owner).setPrice(config.sharePrice, 0);
    });
    
    it("should calculate buy price correctly - no increment - no drift", async () => {
      // Used Contract: Brokerbot      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getBuyPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getBuyPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);
      
      // Do 100 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
        const priceRandomNumberShares = await brokerbot.getBuyPrice(randomNumberShares);
        expect(priceOneShare.mul(randomNumberShares)).to.eq(priceRandomNumberShares);
      }
    });
    
    it("should calculate sell price correctly - no increment - no drift", async () => {
      // Used Contract: Brokerbot
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getSellPrice(0);
      expect(priceZeroShares.isZero()).to.equal(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getSellPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);
      
      // Do 100 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
        const priceRandomNumberShares = await brokerbot.getSellPrice(randomNumberShares);
        expect(priceOneShare.mul(randomNumberShares)).to.eq(priceRandomNumberShares);
      }
    });
    
    it("should set increment correctly (0.001 per share)", async () => {
      // Used Contract: Brokerbot
      // Get existing and reset while incrementing by delta
      const price = await brokerbot.getPrice();
      const incrementBefore = await brokerbot.increment();
      const delta = ethers.BigNumber.from("1000000000000000");
      await brokerbot.connect(owner).setPrice(price, incrementBefore.add(delta));
      const incrementAfter = await brokerbot.increment();
      
      // Check result
      expect(incrementBefore.add(delta)).to.eq(incrementAfter);
    });
    
    it("should calculate buy price correctly - with increment - no drift", async () => {
      // Used Contract: Brokerbot
      // Initialize with random increment
      const increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 1000 }).toString(),"finney");
      
      /*const increment = web3.utils.toWei(new Chance().integer({ min: 1, max: 1000 }),
        "milli"
        );*/
      await brokerbot.connect(owner).setPrice(config.sharePrice, increment);
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getBuyPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getBuyPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);
      
      // Do 10 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
        // Get price from contract
        const priceRandomNumberShares = await brokerbot.getBuyPrice(
          randomNumberShares
        );
          
        // Calculate the most straightforward way
        let calculatedPrice = ethers.BigNumber.from(0);
        let priceForShare = priceOneShare;
        for (let share = 0; share < randomNumberShares; share++) {
          calculatedPrice = calculatedPrice.add(priceForShare);
          priceForShare = priceForShare.add(increment);
        }
        
        // Check result
        expect(priceRandomNumberShares).to.eq(calculatedPrice);
      }
    });
          
    it("should calculate sell price correctly - with increment - no drift", async () => {
      // Used Contract: Brokerbot
      // Initialize with random increment
      const increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 10000 }).toString(),
        "gwei"
        );
      await brokerbot.connect(owner).setPrice(config.sharePrice, increment);
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getSellPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getSellPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice.sub(increment));
      
      // Do 10 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
          // Get price from contract
          const priceRandomNumberShares = await brokerbot.getSellPrice(
            randomNumberShares
            );
            
            // Calculate the most straightforward way
            let calculatedPrice = ethers.BigNumber.from(0);
            let priceForShare = priceOneShare;
            for (let share = 0; share < randomNumberShares; share++) {
              calculatedPrice = calculatedPrice.add(priceForShare);
              priceForShare = priceForShare.sub(increment);
            }
            
            // Check result
            expect(priceRandomNumberShares).to.eq(calculatedPrice);
      }
    });

    it("Should calculate buy price correctly - no increment - with drift", async () => {
      // Used Contract: Brokerbot
      // Initialize with random drift
      const oneDay = 24 * 60 * 60;
      const secondsPerStep = 10;
      const driftIncrement = ethers.utils.parseEther("0.001");

      await brokerbot.connect(owner).setPrice(config.sharePrice, 0);
      await brokerbot.connect(owner).setDrift(secondsPerStep, driftIncrement);
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getBuyPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share at start
      const priceOneShare = await brokerbot.getBuyPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);

      let currentPrice = priceOneShare;
      
      // Do 10 times with random number times after start
      for (let i = 0; i < 10; i++) {
        const randomNumberDays = new Chance().natural({ min: 2, max: 30 });
        // 
        await ethers.provider.send("evm_increaseTime", [oneDay*randomNumberDays]);
        await ethers.provider.send("evm_mine");
        // Get price from contract
        const priceRandomNumberDays = await brokerbot.getBuyPrice(1);
        let calculatedPrice = currentPrice.add(driftIncrement.mul((oneDay*randomNumberDays)/secondsPerStep));
        // Check result
        expect(priceRandomNumberDays).to.eq(calculatedPrice);
        currentPrice = calculatedPrice;
      }
    });

    it("Should calculate sell price correctly - no increment - with negative drift", async () => {
      // Used Contract: Brokerbot
      // Initialize with random drift
      const oneDay = 24 * 60 * 60;
      const secondsPerStep = 100;
      const driftIncrement = ethers.utils.parseEther("-0.0001");
      const startPrice = ethers.utils.parseEther("5");

      await brokerbot.connect(owner).setPrice(startPrice, 0);
      await brokerbot.connect(owner).setDrift(secondsPerStep, driftIncrement);
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getSellPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share at start
      const priceOneShare = await brokerbot.getSellPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);

      let currentPrice = priceOneShare;
      
      // Do 10 times with random number times after start
      for (let i = 0; i < 10; i++) {
        const randomNumberDays = new Chance().natural({ min: 2, max: 30 });
        // 
        await ethers.provider.send("evm_increaseTime", [oneDay*randomNumberDays]);
        await ethers.provider.send("evm_mine");
        // Get price from contract
        const priceRandomNumberDays = await brokerbot.getSellPrice(1);
        let calculatedPrice = currentPrice.add(driftIncrement.mul((oneDay*randomNumberDays)/secondsPerStep));
        // Check result
        if(calculatedPrice < 0 ) {
          expect(priceRandomNumberDays).to.eq(0);
        } else {
          expect(priceRandomNumberDays).to.eq(calculatedPrice);
        }
        currentPrice = calculatedPrice;
      }
    });
  });
        
  describe("setting", () => {
    before(async () => {
      await brokerbot.connect(owner).setPrice(config.sharePrice, 0);
    });
    it("should allow enabling/disabling buying/selling.", async () => {
      // Used Contract: Brokerbot
      //await brokerbot.connect(owner).setSettings(BUYING_ENABLED);
      await brokerbot.connect(owner).setEnabled(true, false);      
      expect(await buyingEnabled(brokerbot)).to.eq(true);
      expect(await sellingEnabled(brokerbot)).to.equal(false);
      
      await brokerbot.connect(owner).setEnabled(false, true);
      //await brokerbot.setSettings(SELLING_ENABLED);
      expect(await buyingEnabled(brokerbot)).to.equal(false);
      expect(await sellingEnabled(brokerbot)).to.equal(true);
      
      await brokerbot.connect(owner).setEnabled(true, true);
      //await brokerbot.setSettings(BUYING_ENABLED | SELLING_ENABLED);
      expect(await buyingEnabled(brokerbot)).to.equal(true);
      expect(await sellingEnabled(brokerbot)).to.equal(true);
      
      await brokerbot.connect(owner).setEnabled(false, false);
      //await brokerbot.setSettings("0x0");
      expect(await buyingEnabled(brokerbot)).to.equal(false);
      expect(await sellingEnabled(brokerbot)).to.equal(false);
    });
    
    it("should not allow buying shares when buying is disabled", async () => {
      // Used Contract: Brokerbot, Payment Hub
      // Disable buying
      await brokerbot.connect(owner).setEnabled(false, true);
      
      // Random number of shares to buy
      const sharesToBuy = new Chance().natural({ min: 1, max: 500 });
      const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);
      const buyPriceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](buyPrice, brokerbot.address);
      
      // Base payment should fail
      await expect(paymentHub.connect(owner)["payAndNotify(address,uint256,bytes)"](
        brokerbot.address, buyPrice, "0x20"))
        .to.be.revertedWith("buying disabled");
        
      // ETH payment should fail
      await expect(paymentHub.connect(owner).payFromEtherAndNotify(
        brokerbot.address, buyPrice, "0x20", { value: buyPriceInETH }))
        .to.be.revertedWith("buying disabled");
    });
        
    it("should not allow selling shares when selling is disabled", async () => {
      // Used Contract: Brokerbot, Payment Hub, Draggable Shares
      // Disable selling
      await brokerbot.connect(owner).setEnabled(true, false);
      
      // Random number of shares to buy
      const sharesToSell = new Chance().natural({ min: 1, max: 500 });
      
      // Base payment should fail
      await expect(paymentHub.connect(owner)["payAndNotify(address,address,uint256,bytes)"](
        draggableShares.address,
        brokerbot.address,
        sharesToSell,
        "0x20"
      )).to.be.revertedWith("selling disabled");

      // reanable selling 
      await brokerbot.connect(owner).setEnabled(true, true);
    });
  });
  
  describe("shares", () => {  
    it("should calculate number of shares for given baseCurrency amount sent (getShares)", async () => {
      // Used Contract: Brokerbot
      // Set random price and increment
      const price = ethers.utils.parseUnits(new Chance().integer({ min: 1000, max: 10000 }).toString(),
        "finney"
        );
      const increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 1000 }).toString(),
        "finney"
        );
        await brokerbot.connect(owner).setPrice(price, increment);
        
        // No payment no shares
        const sharesZeroPaid = await brokerbot.getShares(0);
        expect(sharesZeroPaid.isZero()).to.equal(true);
        
        // Sent payment worth 1 share
        const singlePrice = await brokerbot.getBuyPrice(1);
        const sharesSinglePaid = await brokerbot.getShares(singlePrice);
        expect(sharesSinglePaid).to.eq(1);
        
        // Repeat with random number of shares
        for (let i = 0; i < 10; i++) {
          const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
          const priceRandomNumberShares = await brokerbot.getBuyPrice(
            randomNumberShares
            );
          const calculatedShares = await brokerbot.getShares(priceRandomNumberShares);
          expect(calculatedShares).to.eq(randomNumberShares);
        }
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
      const costs = [
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
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

      await brokerbot.connect(owner).notifyTradesAndTransfer(buyers, shares, costs, ref);

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
            balance = balance.add(shares[j]);
          }
        }
        expect(balance).to.eq(buyerBalancesAfter[i]);
      }

      const totalShares = shares.reduce((a, b) => a + b, 0);
      expect(brokerbotBalanceBefore.sub(totalShares)).to.eq(brokerbotBalanceAfter);
    });

    it("should be able to externaly distribute shares to multiple shareholders", async () => {
      // Used Contract: Brokerbot, Draggable Shares
      // Initialize with random increment
      let increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 10000 }).toString(),
      "gwei"
      );
      await brokerbot.connect(owner).setPrice(config.sharePrice, increment);

      const price1 = await brokerbot.getBuyPrice(1);

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
      const costs = [
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
        "1000000000000000000",
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

      const sharesAmount = shares.reduce((a,b) => a+b, 0);

      await brokerbot.connect(owner).notifyTrades(buyers, shares, costs, ref);

      const price2 = await brokerbot.getBuyPrice(1);

      const brokerbotBalanceAfter = await draggableShares.balanceOf(
        brokerbot.address
      );
      const buyerBalancesAfter = await Promise.all(
        buyers.map(async (address) => {
          return await draggableShares.balanceOf(address);
        })
      );

      for (let i = 0; i < buyers.length; i++) {
        let balance = buyerBalancesBefore[i];
        expect(balance).to.eq(buyerBalancesAfter[i]);
      }

      expect(brokerbotBalanceBefore).to.eq(brokerbotBalanceAfter);
      expect(price1.add(increment.mul(sharesAmount))).to.eq(price2);
    });
    
    it('should support external trades', async () => {
      // Used Contract: Brokerbot
      // Initialize with random increment
      let increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 10000 }).toString(),
      "gwei"
      );
      await brokerbot.connect(owner).setPrice(config.sharePrice, increment);
      
      let balanceBefore = await draggableShares.balanceOf(brokerbot.address);
      let price1 = await brokerbot.getBuyPrice(1);
      const amountBuy1 = 700;
      const priceAfterBuy1 = price1.add(increment.mul(amountBuy1));
      await expect(brokerbot.connect(owner).notifyTrade(accounts[0], amountBuy1, price1.mul(amountBuy1), "0x"))
        .to.emit(brokerbot, 'Trade').withArgs(
          draggableShares.address, accounts[0], "0x", amountBuy1, baseCurrency.address, price1.mul(amountBuy1), 0, priceAfterBuy1
        );
      const amountBuy2 = 300;
      const priceAfterBuy2 = priceAfterBuy1.add(increment.mul(amountBuy2));
      await expect(await brokerbot.connect(owner).notifyTradeAndTransfer(accounts[0], amountBuy2, price1.mul(amountBuy2), "0x"))
        .to.emit(brokerbot, 'Trade').withArgs(
          draggableShares.address, accounts[0], "0x", amountBuy2, baseCurrency.address, price1.mul(amountBuy2), 0, priceAfterBuy2
        );
      let price2 = await brokerbot.getBuyPrice(1);
      let balanceAfter = await draggableShares.balanceOf(brokerbot.address);
      
      expect(price1.add(increment.mul(amountBuy1+amountBuy2))).to.eq(price2);
      // only the amount at buy2 (300) with transfer should change balance
      expect(balanceAfter.add(300)).to.eq(balanceBefore);
    })
    
    it('should allow selling shares against BaseCurrency', async () => {
      await brokerbot.connect(owner).setPrice(config.sharePrice, 0);
      const sellPrice = await brokerbot.getSellPrice(10);
      const baseCurrencyBefore = await baseCurrency.balanceOf(sig1.address);

      await expect(draggableShares.connect(sig1).transferAndCall(brokerbot.address, 10, "0x04"))
        .to.be.revertedWith("unknown ref");
      expect(await draggableShares.connect(sig1).transferAndCall(brokerbot.address, 10, "0x"))
        .to.emit(brokerbot, "Trade").withArgs(
          draggableShares.address, sig1.address, 10, baseCurrency.address, "1000000000000000000", 0, sellPrice
        );
      const baseCurrencyAfter = await baseCurrency.balanceOf(sig1.address);
      expect(baseCurrencyBefore.add(sellPrice)).to.be.equal(baseCurrencyAfter);
    })

    it("Should allow indirect sale", async () => {
      const baseCurrencyBefore = await baseCurrency.balanceOf(sig1.address);
      await draggableShares.connect(sig1).transferAndCall(brokerbot.address, 10, "0x02");
      const baseCurrencyAfter = await baseCurrency.balanceOf(sig1.address);
      expect(baseCurrencyBefore).to.be.equal(baseCurrencyAfter);
    })

    it("Should revert when onTokenTransfer is called direct", async () => {
      await expect(brokerbot.connect(owner).onTokenTransfer(accounts[0], 100, "0x")).to.be.revertedWith("invalid token");
    })

    it("Should revert when processIncomming is called direct", async () => {
      await expect(brokerbot.connect(owner).processIncoming(config.baseCurrencyAddress, accounts[0], 100, "0x")).to.be.revertedWith("invalid caller");
    })

    it("Should be able to withdraw erc20 from brokerbot", async () => {
      await expect(brokerbot.connect(sig1).withdraw(draggableShares.address, owner.address, 10))
        .to.be.revertedWith("not owner nor hub");
      const ownerBalBefore = await draggableShares.balanceOf(owner.address);
      await brokerbot.connect(owner).withdraw(draggableShares.address, owner.address, 10);
      const ownerBalAfter = await draggableShares.balanceOf(owner.address);
      expect(ownerBalBefore.add(10)).to.be.equal(ownerBalAfter);

    })
  });
  
});
