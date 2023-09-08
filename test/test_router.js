const {network, ethers, deployments, } = require("hardhat");
const { setBalances, getBlockTimeStamp } = require("./helper/index");
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
    await deployments.fixture(["Shares", "DraggableShares", "PaymentHub", "Brokerbot", "BrokerbotRegistry", "BrokerbotRouter"]);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotRouter = await ethers.getContract("BrokerbotRouter");
  })
  describe("Deployment", () => {
    it("Should be deploy successfully", async () => {
      expect(brokerbotRouter.address).to.exist;
    })
    it("Should get brokerbot from base and token", async () => {
      let [bot, hub] = await brokerbotRouter.getBrokerbotAndPaymentHub(baseCurrency.address, draggable.address);
      expect(bot).to.equal(brokerbot.address);
      expect(hub).to.equal(paymentHub.address);
    })
  });
  describe("Swaps", () => {
    beforeEach(async () => {
      // Set (manipulate local) balances (xchf) for first 5 accounts
      await setBalances(accounts, baseCurrency);
      //Mint shares to first 5 accounts
      for( let i = 0; i < 5; i++) {
        await shares.connect(owner).mint(accounts[i], 2000000);
        await shares.connect(signers[i]).approve(draggable.address, config.infiniteAllowance);
        await draggable.connect(signers[i]).wrap(accounts[i], 600000);
      }
      // Deposit some shares to Brokerbot
      await draggable.connect(owner).transfer(brokerbot.address, 500000 );
      await baseCurrency.connect(owner).transfer(brokerbot.address, ethers.utils.parseEther("100000"));
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
          // get path draggable - weth - dai (in reverse order because of exact out)
          const types = ["address", "uint24","address","uint24","address","uint24","address"];
          const values = [draggable.address, 0, config.baseCurrencyAddress, 3000, config.wethAddress, 500, config.daiAddress];
          path = ethers.utils.solidityPack(types,values);
          //approve dai to router
          await daiContract.connect(buyer).approve(brokerbotRouter.address, config.infiniteAllowance);
          //approve dai in paymenthub
          await paymentHub.approveERC20(config.daiAddress);
          // log balance
          const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
          const brokerbotBalanceBefore = await daiContract.balanceOf(brokerbot.address);
          // buy shares via router
          const params = {
            path: path,
            recipient: buyer.address,
            deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
            amountOut: randomShareAmount,
            
          }
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
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        const sellerUsdcBalanceBefore = await usdcContract.balanceOf(seller.address);
        await draggable.connect(seller).approve(brokerbotRouter.address, randomShareAmount);
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
        const params = {
          path: path,
          recipient: seller.address,
          deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
          amountIn: randomShareAmount,
          amountOutMinimum: usdcAmount
        };
        await brokerbotRouter.connect(seller).exactInput(params);
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
        const sellerBalanceAfter = await draggable.balanceOf(seller.address);
        const sellerUsdcBalanceAfter = await usdcContract.balanceOf(seller.address);
        expect(brokerbotBalanceBefore.sub(baseAmount)).to.equal(brokerbotBalanceAfter);
        expect(sellerBalanceBefore.sub(randomShareAmount)).to.equal(sellerBalanceAfter);
        expect(sellerUsdcBalanceBefore.add(usdcAmount)).to.equal(sellerUsdcBalanceAfter);
      })
      it("Should revert sell shares via router if deadline is reached", async () => {
        const seller = sig2;
        const sellerBalanceBefore = await draggable.balanceOf(seller.address);
        await draggable.connect(seller).approve(brokerbotRouter.address, randomShareAmount);
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