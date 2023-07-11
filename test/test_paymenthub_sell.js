const {network, ethers, deployments, } = require("hardhat");
const { setBalances } = require("./helper/index");
const Chance = require("chance");
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { encodeRouteToPath } = require("@uniswap/v3-sdk");
const { expect } = require("chai");
const { decodeError } = require('ethers-decode-error');

// Shared  Config
const config = require("../scripts/deploy_config.js");
const { baseCurrencyAddress } = require("../scripts/deploy_config.js");

describe("Sell via PaymentHub", () => {
  let shares;
  let baseCurrency;
  let paymentHub;
  let brokerbot;
  let brokerbotDAI;
  let daiContract;
  let wbtcContract;
  let usdcContract;
  let wethContract

  let deployer;
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;

  let chance;
  let xchfamount
  let daiAmount
  let randomShareAmount
  let path;

  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    chance = new Chance();

    // deploy contracts
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    daiContract = await ethers.getContractAt("ERC20Named", config.daiAddress);
    wbtcContract = await ethers.getContractAt("ERC20Named", config.wbtcAddress)
    usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);
    wethContract = await ethers.getContractAt("ERC20Named", config.wethAddress);

    await deployments.fixture(["Shares", "DraggableShares", "PaymentHub", "Brokerbot", "BrokerbotDAI"]);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotDAI = await ethers.getContract("BrokerbotDAI");

    // Set (manipulate local) balances (xchf,dai,wbtc) for first 5 accounts
    await setBalances(accounts, baseCurrency, daiContract, wbtcContract);

    //Mint shares to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await shares.connect(owner).mint(accounts[i], 2000000);
      await shares.connect(signers[i]).approve(draggable.address, config.infiniteAllowance);
      await draggable.connect(signers[i]).wrap(accounts[i], 600000);
    }

    // Deposit some shares to Brokerbot
    await draggable.connect(owner).transfer(brokerbot.address, 500000 );
    await shares.connect(owner).transfer(brokerbotDAI.address, 500000);
    await baseCurrency.connect(owner).transfer(brokerbot.address, ethers.utils.parseEther("100000"));
  });

  describe("Selling against ERC20", () => {
    beforeEach(async () => {
      randomShareAmount = chance.natural({ min: 50, max: 500 });
      xchfamount = await brokerbot.getBuyPrice(randomShareAmount);
    })
    it("Should sell against USDC", async () => {
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 500, config.usdcAddress];
      path = ethers.utils.solidityPack(types,values);
      const usdcAmount = await paymentHub.callStatic["getPriceERC20(uint256,bytes,bool)"](xchfamount, path, false);
      //console.log(`xchfaumont: ${ethers.utils.formatUnits(xchfamount,18)}`);
      //console.log(`usdcAmount: ${ethers.utils.formatUnits(usdcAmount,6)}`);
      expect(parseFloat(ethers.utils.formatUnits(usdcAmount,6))).to.be.above(parseFloat(ethers.utils.formatUnits(xchfamount,18)));
      await paymentHub.approveERC20(config.baseCurrencyAddress);
      await draggable.connect(sig1).approve(paymentHub.address, config.infiniteAllowance);
      expect(await usdcContract.balanceOf(sig1.address)).to.equal(0);
      // in real use case slippage should be considerered for usdcAmount (the miniminum out amount from the swap)
      await paymentHub.sellSharesAndSwap(brokerbot.address, draggable.address, sig1.address, sig1.address, randomShareAmount, "0x01", usdcAmount, path, false);
      expect(await usdcContract.balanceOf(sig1.address)).to.equal(usdcAmount)
    })

    it("Should sell against WETH", async () => {
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress];
      path = ethers.utils.solidityPack(types,values);
      const ethAmount = await paymentHub.callStatic["getPriceERC20(uint256,bytes,bool)"](xchfamount, path, false);
      //console.log(`ethAmount: ${ethers.utils.formatEther(ethAmount)}`);
      await paymentHub.approveERC20(config.baseCurrencyAddress);
      await draggable.connect(sig1).approve(paymentHub.address, config.infiniteAllowance);
      expect(await wethContract.balanceOf(sig1.address)).to.equal(0);
      // in real use case slippage should be considerered for ethAmount (the miniminum out amount from the swap)
      await paymentHub.sellSharesAndSwap(brokerbot.address, draggable.address, sig1.address, sig1.address, randomShareAmount, "0x01", ethAmount, path, false);
      expect(await wethContract.balanceOf(sig1.address)).to.equal(ethAmount);
    })
  })

  describe("Selling against ETH", () => {
    beforeEach(async () => {
      randomShareAmount = chance.natural({ min: 50, max: 500 });
      xchfamount = await brokerbot.getBuyPrice(randomShareAmount);
    })
    it("Should sell against ETH", async () => {
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress];
      path = ethers.utils.solidityPack(types,values);
      const ethAmount = await paymentHub.callStatic["getPriceERC20(uint256,bytes,bool)"](xchfamount, path, false);
      //console.log(`ethAmount: ${ethers.utils.formatEther(ethAmount)}`);
      await paymentHub.approveERC20(config.baseCurrencyAddress);
      await draggable.connect(sig1).approve(paymentHub.address, config.infiniteAllowance);
      const ethBalanceSellerBefore = await ethers.provider.getBalance(sig1.address);
      // in real use case slippage should be considerered for ethAmount (the miniminum out amount from the swap)
      await paymentHub.sellSharesAndSwap(brokerbot.address, draggable.address, sig1.address, sig1.address, randomShareAmount, "0x01", ethAmount, path, true);
      const ethBalanceSellerAfter = await ethers.provider.getBalance(sig1.address);
      expect(ethBalanceSellerAfter.sub(ethBalanceSellerBefore)).to.equal(ethAmount);
      expect(await wethContract.balanceOf(paymentHub.address)).to.equal(0);
      expect(await ethers.provider.getBalance(paymentHub.address)).to.equal(0);
    })

  })

})