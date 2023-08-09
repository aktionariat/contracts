const {network, ethers, deployments, } = require("hardhat");
const { setBalances, getBlockTimeStamp } = require("./helper/index");
const Chance = require("chance");
const { expect } = require("chai");
const { decodeError } = require('ethers-decode-error');

// Shared  Config
const config = require("../scripts/deploy_config.js");
const { baseCurrencyAddress } = require("../scripts/deploy_config.js");

describe("Brokerbot Router", () => {
  let draggable;
  let shares;
  let paymentHub;
  let brokerbot;
  let brokerbotRouter;
  let baseCurrency;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;

  let chance;
  let randomShareAmount;
  let xchfamount;
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
    wbtcContract = await ethers.getContractAt("ERC20Named", config.wbtcAddress)
  });
  beforeEach(async () => {
    // deploy contracts
    await deployments.fixture(["Shares", "DraggableShares", "PaymentHub", "Brokerbot", "BrokerbotRouter"]);
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
    it("Should have correct registry set", async () => {
      expect(await brokerbotRouter.brokerbotRegistry()).to.equal(config.brokerbotRegistry);
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
      xchfamount = await brokerbot.getBuyPrice(randomShareAmount);
    })
    it("Should buy shares via router", async () => {
      const buyer = sig1;
      const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
      await baseCurrency.connect(buyer).approve(brokerbotRouter.address, xchfamount);
      const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
      const params = {
        tokenIn: baseCurrency.address,
        tokenOut: draggable.address,
        fee: 0,
        recipient: buyer.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountOut: randomShareAmount,
        amountInMaximum: xchfamount,
        sqrtPriceLimitX96: 0
      }
      await brokerbotRouter.connect(buyer).exactOutputSingle(params);
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
      const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
      expect(brokerbotBalanceBefore.add(xchfamount)).to.equal(brokerbotBalanceAfter);
      expect(buyerBalanceBefore.add(randomShareAmount)).to.equal(buyerBalanceAfter);
    });
    it("Should revert buy shares via router if deadline reached", async () => {
      const buyer = sig1;
      const buyerBalanceBefore = await draggable.balanceOf(buyer.address);
      await baseCurrency.connect(buyer).approve(brokerbotRouter.address, xchfamount);
      const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
      const params = {
        tokenIn: baseCurrency.address,
        tokenOut: draggable.address,
        fee: 0,
        recipient: buyer.address,
        deadline: 0,
        amountOut: randomShareAmount,
        amountInMaximum: xchfamount,
        sqrtPriceLimitX96: 0
      }
      await expect(brokerbotRouter.connect(buyer).exactOutputSingle(params))
        .to.be.revertedWithCustomError(brokerbotRouter, "Brokerbot_Deadline_Reached");
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
      const buyerBalanceAfter = await draggable.balanceOf(buyer.address);
      expect(brokerbotBalanceBefore).to.equal(brokerbotBalanceAfter);
      expect(buyerBalanceBefore).to.equal(buyerBalanceAfter);
    });
    it("Should sell shares via router", async () => {
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
        amountOutMinimum: xchfamount,
        sqrtPriceLimitX96: 0
      }
      await brokerbotRouter.connect(seller).exactInputSingle(params);
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
      const sellerBalanceAfter = await draggable.balanceOf(seller.address);
      expect(brokerbotBalanceBefore.sub(xchfamount)).to.equal(brokerbotBalanceAfter);
      expect(sellerBalanceBefore.sub(randomShareAmount)).to.equal(sellerBalanceAfter);
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
        amountOutMinimum: xchfamount,
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
});