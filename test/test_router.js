const {network, ethers, deployments, } = require("hardhat");
const { setup, setBalances, getBlockTimeStamp } = require("./helper/index");
const Chance = require("chance");
const { expect } = require("chai");
const { decodeError } = require('ethers-decode-error');

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Brokerbot Router", () => {
  let draggable;
  let shares;
  let paymentHub;
  let brokerbot;
  let brokerbotRouter;
  let brokerbotQuoter;
  let baseCurrency;
  let daiContract

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;

  let chance;
  let randomShareAmount;
  let baseAmount;
  let baseBuyPrice;
  let baseSellPrice;

  let pathUsdc;
  let pathBaseUsdc;
  let pathDai;
  let pathWeth;
  let pathSingle;
  let blockTimestamp;
  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    chance = new Chance();

    // get common contracts
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    daiContract = await ethers.getContractAt("ERC20Named", config.daiAddress);
    wbtcContract = await ethers.getContractAt("ERC20Named", config.wbtcAddress);
    usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);

  });
  beforeEach(async () => {
    // deploy contracts
    await setup(true);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotRouter = await ethers.getContract("BrokerbotRouter");
    brokerbotQuoter = await ethers.getContract("BrokerbotQuoter");

    // build paths
    // shares - base - usdc - dai
    let types = ["address", "uint24","address","uint24","address","uint24","address"];
    let values = [draggable.address, 0, config.baseCurrencyAddress, 500, config.usdcAddress, 500, config.daiAddress];
    pathDai = ethers.utils.solidityPack(types,values);
    // shares - base - usdc
    types = ["address","uint24","address","uint24","address"];
    values = [draggable.address, 0, config.baseCurrencyAddress, 500, config.usdcAddress];
    pathUsdc = ethers.utils.solidityPack(types,values);
    // base - usdc
    types = ["address","uint24","address"];
    values = [config.baseCurrencyAddress, 500, config.usdcAddress];
    pathBaseUsdc = ethers.utils.solidityPack(types,values);
    // shares - base - usdc - weth
    types = ["address", "uint24","address","uint24","address","uint24","address"];
    values = [draggable.address, 0, config.baseCurrencyAddress, 500, config.usdcAddress, 500, config.wethAddress];
    pathWeth = ethers.utils.solidityPack(types,values);
    // shares - base 
    types = ["address", "uint24","address"];
    values = [draggable.address, 0, config.baseCurrencyAddress];
    pathSingle = ethers.utils.solidityPack(types,values);

  })
  describe("Deployment", () => {
    it("Should deploy router successfully", async () => {
      expect(brokerbotRouter.address).to.exist;
    })
    it("Should deploy quoter successfully", async () => {
      expect(brokerbotQuoter.address).to.exist;
    })
    it("Should have correct initial state", async () => {
      expect(await brokerbotQuoter.WETH9()).to.equal(config.wethAddress);
    })
  });
  describe("Price Quoting", () => {
    beforeEach(async () => {
      randomShareAmount = chance.natural({ min: 500, max: 50000 });
      baseBuyPrice = await brokerbot.getBuyPrice(randomShareAmount);
      baseSellPrice = await brokerbot.getSellPrice(randomShareAmount);
    })
    describe("Quote for buying", () => {
      it("Should get buy price quote for given share amount and path", async () => {
        const pricePaymentHub = await paymentHub.callStatic["getPriceInERC20(uint256,bytes)"](baseBuyPrice, pathBaseUsdc);
        const priceQuote = await brokerbotQuoter.callStatic["quoteExactOutput(bytes,uint256)"](pathUsdc, randomShareAmount);
        expect(priceQuote).to.equal(pricePaymentHub);
      })
      it("Should get buy price quote for given share amount and draggabe<>base path", async () => {
        const priceQuote = await brokerbotQuoter.callStatic["quoteExactOutput(bytes,uint256)"](pathSingle, randomShareAmount);
        expect(priceQuote).to.equal(baseBuyPrice);
      })
      it("Should get buy price via single quote from quoter", async () => {
        const priceQuote = await brokerbotQuoter.quoteExactOutputSingle(
          baseCurrency.address,
          draggable.address,
          0,
          randomShareAmount,
          0);
        expect(priceQuote).to.equal(baseBuyPrice);
      })
    })
    describe("Quote for selling", () => {
      it("Should get sell price quote for given share amount and path", async () => {
        const pricePaymentHub = await paymentHub.callStatic["getPriceERC20(uint256,bytes,bool)"](baseSellPrice, pathBaseUsdc, false);
        const priceQuote = await brokerbotQuoter.callStatic["quoteExactInput(bytes,uint256)"](pathUsdc, randomShareAmount);
        expect(priceQuote).to.equal(pricePaymentHub);
      })
      it("Should get sell price via single quote from quoter", async () => {
        const priceQuote = await brokerbotQuoter.quoteExactInputSingle(
          draggable.address,
          baseCurrency.address,
          0,
          randomShareAmount,
          0);
        expect(priceQuote).to.equal(baseSellPrice);
      })
    })
  })
  describe("Swaps", () => {
    beforeEach(async () => {
      randomShareAmount = chance.natural({ min: 500, max: 50000 });
    })
    describe("Buy shares", () => {
      beforeEach(async () => {
        baseAmount = await brokerbot.getBuyPrice(randomShareAmount);
      })
      describe("Buy shares single", () => {
        it("Should buy shares with base currency via router", async () => {
          const buyer = sig1;
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          await baseCurrency.connect(buyer).approve(brokerbotRouter.address, baseAmount);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
          const params = {
            tokenIn: baseCurrency.address,
            tokenOut: draggable.address,
            fee: 0,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
            amountOut: randomShareAmount,
            amountInMaximum: baseAmount,
            sqrtPriceLimitX96: 0
          }
          await brokerbotRouter.connect(buyer).exactOutputSingle(params);
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          expect(brokerbotBalanceBefore.add(baseAmount)).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore.add(randomShareAmount)).to.equal(buyerBalanceAfter);
        });
        it("Should revert buy shares via router if deadline reached", async () => {
          const buyer = sig1;
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          await baseCurrency.connect(buyer).approve(brokerbotRouter.address, baseAmount);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
          const params = {
            tokenIn: baseCurrency.address,
            tokenOut: draggable.address,
            fee: 0,
            recipient: buyer.address,
            deadline: 0,
            amountOut: randomShareAmount,
            amountInMaximum: baseAmount,
            sqrtPriceLimitX96: 0
          }
          await expect(brokerbotRouter.connect(buyer).exactOutputSingle(params))
          .to.be.revertedWithCustomError(brokerbotRouter, "Brokerbot_Deadline_Reached");
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          expect(brokerbotBalanceBefore).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore).to.equal(buyerBalanceAfter);
        });
      });
      describe("Buy shares from erc20 with path", () => {
        it("Should buy shares with DAI and swap path via router", async () => {
          const buyer = sig1;
          // get path draggable - base - usdc - dai (in reverse order because of exact out)
          const types = ["address", "uint24","address","uint24","address","uint24","address"];
          const values = [draggable.address, 0, config.baseCurrencyAddress, 500, config.usdcAddress, 500, config.daiAddress];
          path = ethers.utils.solidityPack(types,values);
          // get price in Dai from quoter
          const amountDAI = await brokerbotQuoter.callStatic["quoteExactOutput(bytes,uint256)"](pathDai, randomShareAmount);
          //approve dai to router
          await daiContract.connect(buyer).approve(brokerbotRouter.address, config.infiniteAllowance);
          //approve dai in paymenthub
          await paymentHub.approveERC20(daiContract.address);
          // log balance
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
          const params = {
            path: pathDai,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
            amountOut: randomShareAmount,
            amountInMaximum: amountDAI
          }
          // buy shares via router
          await brokerbotRouter.connect(buyer).exactOutput(params);
          // log balance after
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          // check balances
          expect(brokerbotBalanceBefore.add(baseAmount)).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore.add(randomShareAmount)).to.equal(buyerBalanceAfter);
        })
        it("Should buy shares with xchf and swap path via router", async () => {
          const buyer = sig1;
          // get price in xchf from quoter
          const amountXCHF = await brokerbotQuoter.callStatic["quoteExactOutput(bytes,uint256)"](pathSingle, randomShareAmount);
          expect(amountXCHF).to.equal(baseAmount);
          //approve xchf to router
          await baseCurrency.connect(buyer).approve(brokerbotRouter.address, config.infiniteAllowance);
          // log balance
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
          const params = {
            path: pathSingle,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
            amountOut: randomShareAmount,
            amountInMaximum: amountXCHF
          };
          // buy shares via router
          await brokerbotRouter.connect(buyer).exactOutput(params);
          // log balance after
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          // check balances
          expect(brokerbotBalanceBefore.add(baseAmount)).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore.add(randomShareAmount)).to.equal(buyerBalanceAfter);
        })
      })
    })
    describe("Sell shares", () => {
      beforeEach(async () => {
        baseAmount = await brokerbot.getSellPrice(randomShareAmount);
      })
      it("Should sell shares against base currency via router", async () => {
        const seller = sig2;
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        await draggable.connect(seller).approve(brokerbotRouter.address, randomShareAmount);
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
        const params = {
          tokenIn: draggable.address,
          tokenOut: baseCurrency.address,
          fee: 0,
          recipient: seller.address,
          deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
          amountIn: randomShareAmount,
          amountOutMinimum: baseAmount,
          sqrtPriceLimitX96: 0
        }
        await brokerbotRouter.connect(seller).exactInputSingle(params);
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        expect(brokerbotBalanceBefore.sub(baseAmount)).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore.sub(randomShareAmount)).to.equal(sellerBalanceAfter);
      })
      it("Should sell shares against usdc via router", async () => {
        // base token needs to be approved for uniswap 
        await paymentHub.approveERC20(config.baseCurrencyAddress);
        // path: XCHF -> USDC
        const typesPrice = ["address","uint24","address"];
        const valuesPrice = [config.baseCurrencyAddress, 500, config.usdcAddress];
        pathPrice = ethers.utils.solidityPack(typesPrice,valuesPrice);
        const usdcAmount = await paymentHub.callStatic["getPriceERC20(uint256,bytes,bool)"](baseAmount, pathPrice, false);
        const types = ["address","uint24","address","uint24","address"];
        const values = [draggable.address, 0, config.baseCurrencyAddress, 500, config.usdcAddress];
        path = ethers.utils.solidityPack(types,values);
        const seller = sig2;
        // get balances before
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        const sellerUsdcBalanceBefore = await usdcContract.balanceOf(seller.address);
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
        // approve
        await draggable.connect(seller).approve(brokerbotRouter.address, randomShareAmount);
        const params = {
          path: path,
          recipient: seller.address,
          deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
          amountIn: randomShareAmount,
          amountOutMinimum: usdcAmount
        };
        // make sell
        await brokerbotRouter.connect(seller).exactInput(params);
        // get balances after
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        const sellerUsdcBalanceAfter = await usdcContract.balanceOf(seller.address);
        expect(brokerbotBalanceBefore.sub(baseAmount)).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore.sub(randomShareAmount)).to.equal(sellerBalanceAfter);
        expect(sellerUsdcBalanceBefore.add(usdcAmount)).to.equal(sellerUsdcBalanceAfter);
      })
      it("Should sell shares against xchf via router with path", async () => {
      })
      it("Should revert sell shares via router if deadline is reached", async () => {
        const seller = sig2;
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        // approve
        await draggable.connect(seller).approve(brokerbotRouter.address, randomShareAmount);
        // get balance before
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
        const params = {
          tokenIn: draggable.address,
          tokenOut: baseCurrency.address,
          fee: 0,
          recipient: seller.address,
          deadline: 0,
          amountIn: randomShareAmount,
          amountOutMinimum: baseAmount,
          sqrtPriceLimitX96: 0
        }
        // make sell
        await expect(brokerbotRouter.connect(seller).exactInputSingle(params))
        .to.be.revertedWithCustomError(brokerbotRouter, "Brokerbot_Deadline_Reached");
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        expect(brokerbotBalanceBefore).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore).to.equal(sellerBalanceAfter);
      })
    })
  })
});