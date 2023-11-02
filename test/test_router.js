const {network, ethers, deployments, } = require("hardhat");
const { setup, setBalances, getBlockTimeStamp, randomBigInt } = require("./helper/index");
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
    let values = [await draggable.getAddress(), 0, config.baseCurrencyAddress, 500, config.usdcAddress, 500, config.daiAddress];
    pathDai = ethers.solidityPacked(types,values);
    // shares - base - usdc
    types = ["address","uint24","address","uint24","address"];
    values = [await draggable.getAddress(), 0, config.baseCurrencyAddress, 500, config.usdcAddress];
    pathUsdc = ethers.solidityPacked(types,values);
    // base - usdc
    types = ["address","uint24","address"];
    values = [config.baseCurrencyAddress, 500, config.usdcAddress];
    pathBaseUsdc = ethers.solidityPacked(types,values);
    // shares - base - usdc - weth
    types = ["address", "uint24","address","uint24","address","uint24","address"];
    values = [await draggable.getAddress(), 0, config.baseCurrencyAddress, 500, config.usdcAddress, 500, config.wethAddress];
    pathWeth = ethers.solidityPacked(types,values);
    // shares - base 
    types = ["address", "uint24","address"];
    values = [await draggable.getAddress(), 0, config.baseCurrencyAddress];
    pathSingle = ethers.solidityPacked(types,values);
  });

  describe("Deployment", () => {
    it("Should deploy router successfully", async () => {
      expect(await brokerbotRouter.getAddress()).to.exist;
    });

    it("Should deploy quoter successfully", async () => {
      expect(await brokerbotQuoter.getAddress()).to.exist;
    });

    it("Should have correct initial state", async () => {
      expect(await brokerbotQuoter.WETH9()).to.equal(config.wethAddress);
    });
  });

  describe("Price Quoting", () => {
    beforeEach(async () => {
      randomShareAmount = randomBigInt(500, 50000);
      baseBuyPrice = await brokerbot.getBuyPrice(randomShareAmount);
      baseSellPrice = await brokerbot.getSellPrice(randomShareAmount);
    });

    describe("Quote for buying", () => {
      it("Should get buy price quote for given share amount and path", async () => {
        const pricePaymentHub = await paymentHub.getPriceInERC20.staticCall(baseBuyPrice, pathBaseUsdc);
        const priceQuote = await brokerbotQuoter.quoteExactOutput.staticCall(pathUsdc, randomShareAmount);
        expect(priceQuote).to.equal(pricePaymentHub);
      });

      it("Should get buy price quote for given share amount and draggabe<>base path", async () => {
        const priceQuote = await brokerbotQuoter.quoteExactOutput.staticCall(pathSingle, randomShareAmount);
        expect(priceQuote).to.equal(baseBuyPrice);
      });

      it("Should get buy price via single quote from quoter", async () => {
        const priceQuote = await brokerbotQuoter.quoteExactOutputSingle(
          await baseCurrency.getAddress(),
          await draggable.getAddress(),
          0,
          randomShareAmount,
          0);
        expect(priceQuote).to.equal(baseBuyPrice);
      });
    });

    describe("Quote for selling", () => {
      it("Should get sell price quote for given share amount and path", async () => {
        const pricePaymentHub = await paymentHub.getPriceERC20.staticCall(baseSellPrice, pathBaseUsdc, false);
        const priceQuote = await brokerbotQuoter.quoteExactInput.staticCall(pathUsdc, randomShareAmount);
        expect(priceQuote).to.equal(pricePaymentHub);
      });

      it("Should get sell price via single quote from quoter", async () => {
        const priceQuote = await brokerbotQuoter.quoteExactInputSingle(
          await draggable.getAddress(),
          await baseCurrency.getAddress(),
          0,
          randomShareAmount,
          0);
        expect(priceQuote).to.equal(baseSellPrice);
      });
    });
  });

  describe("Swaps", () => {
    beforeEach(async () => {
      randomShareAmount = randomBigInt(500, 5000);
    });

    describe("Buy shares", () => {
      beforeEach(async () => {
        baseAmount = await brokerbot.getBuyPrice(randomShareAmount);
      });

      describe("Buy shares single", () => {
        it("Should buy exact shares with base currency via router", async () => {
          const buyer = sig1;
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
          //add slippage
          const baseAmountWithSlippage = baseAmount + ethers.parseEther("0.02");
          await baseCurrency.connect(buyer).approve(await brokerbotRouter.getAddress(), baseAmountWithSlippage);
          const params = {
            tokenIn: await baseCurrency.getAddress(),
            tokenOut: await draggable.getAddress(),
            fee: 0,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
            amountOut: randomShareAmount,
            amountInMaximum: baseAmountWithSlippage,
            sqrtPriceLimitX96: 0
          }
          await brokerbotRouter.connect(buyer).exactOutputSingle(params);
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          expect(await baseCurrency.balanceOf(await brokerbotRouter.getAddress())).to.equal(0);
          expect(await baseCurrency.balanceOf(await paymentHub.getAddress())).to.equal(0);
          expect(brokerbotBalanceBefore + baseAmount).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore + randomShareAmount).to.equal(buyerBalanceAfter);
        });

        it("Should buy shares with ETH via router", async () => {
          const priceInETH = await paymentHub.getPriceInEther.staticCall(baseAmount, await brokerbot.getAddress());
          // send a little bit more for slippage 
          const priceInETHWithSlippage = priceInETH * 101n / 100n;
          const buyer = sig1;
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const params = {
            tokenIn: await baseCurrency.getAddress(),
            tokenOut: await draggable.getAddress(),
            fee: 0,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
            amountOut: randomShareAmount,
            amountInMaximum: priceInETHWithSlippage,
            sqrtPriceLimitX96: 0
          }
          await brokerbotRouter.connect(buyer).exactOutputSingle(params, {value: priceInETHWithSlippage});
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          expect(await baseCurrency.balanceOf(await brokerbotRouter.getAddress())).to.equal(0);
          expect(await baseCurrency.balanceOf(await paymentHub.getAddress())).to.equal(0);
          expect(brokerbotBalanceBefore + baseAmount).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore + randomShareAmount).to.equal(buyerBalanceAfter);
        });

        it("Should revert buy shares via router if deadline reached", async () => {
          const buyer = sig1;
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          await baseCurrency.connect(buyer).approve(await brokerbotRouter.getAddress(), baseAmount);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const params = {
            tokenIn: await baseCurrency.getAddress(),
            tokenOut: await draggable.getAddress(),
            fee: 0,
            recipient: buyer.address,
            deadline: 0,
            amountOut: randomShareAmount,
            amountInMaximum: baseAmount,
            sqrtPriceLimitX96: 0
          }
          await expect(brokerbotRouter.connect(buyer).exactOutputSingle(params))
          .to.be.revertedWithCustomError(brokerbotRouter, "Brokerbot_Deadline_Reached");
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          expect(brokerbotBalanceBefore).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore).to.equal(buyerBalanceAfter);
        });
      });

      describe("Buy shares with path", () => {
        it("Should buy shares with DAI and swap path via router", async () => {
          const buyer = sig1;
          // get price in Dai from quoter
          const amountDAI = await brokerbotQuoter.quoteExactOutput.staticCall(pathDai, randomShareAmount);
          //approve dai to router
          await daiContract.connect(buyer).approve(await brokerbotRouter.getAddress(), config.infiniteAllowance);
          //approve dai in paymenthub
          await paymentHub.approveERC20(await daiContract.getAddress());
          // log balance
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
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
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          // check balances
          expect(brokerbotBalanceBefore + baseAmount).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore + randomShareAmount).to.equal(buyerBalanceAfter);
        });

        it("Should buy shares with xchf and swap path via router", async () => {
          const buyer = sig1;
          // get price in xchf from quoter
          const amountXCHF = await brokerbotQuoter.quoteExactOutput.staticCall(pathSingle, randomShareAmount);
          expect(amountXCHF).to.equal(baseAmount);
          //approve xchf to router
          await baseCurrency.connect(buyer).approve(await brokerbotRouter.getAddress(), config.infiniteAllowance);
          // log balance
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
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
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          // check balances
          expect(brokerbotBalanceBefore + baseAmount).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore + randomShareAmount).to.equal(buyerBalanceAfter);
        });

        it("Should buy shares with xchf + sliagge and swap path via router and return unused xchf", async () => {
          const buyer = sig1;
          // get price in xchf from quoter
          const amountXCHF = await brokerbotQuoter.callStatic["quoteExactOutput(bytes,uint256)"](pathSingle, randomShareAmount);
          expect(amountXCHF).to.equal(baseAmount);
          // add arbitrary slipplage
          const amountXCHFWithSlippage = amountXCHF.add(ethers.utils.parseUnits("1000", "18"));
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
            amountInMaximum: amountXCHFWithSlippage
          };
          // buy shares via router
          await brokerbotRouter.connect(buyer).exactOutput(params);
          // log balance after
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          // check balances
          expect(brokerbotBalanceBefore.add(baseAmount)).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore.add(randomShareAmount)).to.equal(buyerBalanceAfter);
        });

        it("Should buy shares with ether and swap path via router", async () => {
          const buyer = sig1;
          // get price in weth from quoter
          const amountWeth = await brokerbotQuoter.quoteExactOutput.staticCall(pathWeth, randomShareAmount);
          const priceInETH = await paymentHub.getPriceInEther.staticCall(baseAmount, await brokerbot.getAddress());
          const priceInETHWithSlippage = amountWeth * 101n / 100n;
          // log balance
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const buyerETHBalanceBefore = await ethers.provider.getBalance(buyer.address);
          const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const params = {
            path: pathWeth,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 2),
            amountOut: randomShareAmount,
            amountInMaximum: priceInETHWithSlippage
          }
          // buy shares via router
          const txInfo = await brokerbotRouter.connect(buyer).exactOutput(params, {value: priceInETHWithSlippage});
          //console.log(await txInfo.wait());
          const { gasPrice, cumulativeGasUsed} = await txInfo.wait();
          const gasCost = gasPrice * cumulativeGasUsed;
          // log balance after
          const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
          const buyerETHBalanceAfter = await ethers.provider.getBalance(buyer.address);
          const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
          // check balances
          expect(brokerbotBalanceBefore + baseAmount).to.equal(brokerbotBalanceAfter);
          expect(buyerBalanceBefore + randomShareAmount).to.equal(buyerBalanceAfter);
          expect(buyerETHBalanceBefore - buyerETHBalanceAfter).to.equal(priceInETH + gasCost);
        });
      });
    });

    describe("Sell shares", () => {
      beforeEach(async () => {
        baseAmount = await brokerbot.getSellPrice(randomShareAmount);
      });

      it("Should sell shares against base currency via router", async () => {
        const seller = sig2;
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        await draggable.connect(seller).approve(await brokerbotRouter.getAddress(), randomShareAmount);
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
        const params = {
          tokenIn: await draggable.getAddress(),
          tokenOut: await baseCurrency.getAddress(),
          fee: 0,
          recipient: seller.address,
          deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
          amountIn: randomShareAmount,
          amountOutMinimum: baseAmount,
          sqrtPriceLimitX96: 0
        }
        await brokerbotRouter.connect(seller).exactInputSingle(params);
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        expect(brokerbotBalanceBefore - baseAmount).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore - randomShareAmount).to.equal(sellerBalanceAfter);
      });

      it("Should sell shares against base currency with swap path via router", async () => {
        const seller = sig2;
        // get balances before
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        const sellerBaseBalanceBefore = await baseCurrency.balanceOf(seller.address);
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
        // approve
        await draggable.connect(seller).approve(await brokerbotRouter.getAddress(), randomShareAmount);
        const params = {
          path: pathSingle,
          recipient: seller.address,
          deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
          amountIn: randomShareAmount,
          amountOutMinimum: baseAmount  
        };
        // make sell
        await brokerbotRouter.connect(seller).exactInput(params);
        // get balances after
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        const sellerBaseBalanceAfter = await baseCurrency.balanceOf(seller.address);
        expect(brokerbotBalanceBefore - baseAmount).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore - randomShareAmount).to.equal(sellerBalanceAfter);
        expect(sellerBaseBalanceAfter - sellerBaseBalanceBefore).to.equal(baseAmount);
      });

      it("Should sell shares against usdc with path via router", async () => {
        // base token needs to be approved for uniswap 
        await paymentHub.approveERC20(config.baseCurrencyAddress);
        // path: XCHF -> USDC
        const usdcAmount = await paymentHub.getPriceERC20.staticCall(baseAmount, pathBaseUsdc, false);
        const seller = sig2;
        // get balances before
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        const sellerUsdcBalanceBefore = await usdcContract.balanceOf(seller.address);
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
        // approve
        await draggable.connect(seller).approve(await brokerbotRouter.getAddress(), randomShareAmount);
        const params = {
          path: pathUsdc,
          recipient: seller.address,
          deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
          amountIn: randomShareAmount,
          amountOutMinimum: usdcAmount
        };
        // make sell
        await brokerbotRouter.connect(seller).exactInput(params);
        // get balances after
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        const sellerUsdcBalanceAfter = await usdcContract.balanceOf(seller.address);
        expect(brokerbotBalanceBefore - baseAmount).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore - randomShareAmount).to.equal(sellerBalanceAfter);
        expect(sellerUsdcBalanceBefore + usdcAmount).to.equal(sellerUsdcBalanceAfter);
      });

      it("Should revert sell shares via router if deadline is reached", async () => {
        const seller = sig2;
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        // approve
        await draggable.connect(seller).approve(await brokerbotRouter.getAddress(), randomShareAmount);
        // get balance before
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
        const params = {
          tokenIn: await draggable.getAddress(),
          tokenOut: await baseCurrency.getAddress(),
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
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        expect(brokerbotBalanceBefore).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore).to.equal(sellerBalanceAfter);
      });
    });
  });
});