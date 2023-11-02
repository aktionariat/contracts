const {network, ethers, deployments, } = require("hardhat");
const { setBalances, getTX, getBlockTimeStamp } = require("./helper/index");
const Chance = require("chance");
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { encodeRouteToPath } = require("@uniswap/v3-sdk");
const { expect } = require("chai");
const { decodeError } = require('ethers-decode-error');

// Shared  Config
const config = require("../scripts/deploy_config.js");
const { baseCurrencyAddress } = require("../scripts/deploy_config.js");
const { Signature } = require("ethers");

describe("Sell via PaymentHub", () => {
  let shares;
  let baseCurrency;
  let paymentHub;
  let brokerbot;
  let multiSigCloneFactory;
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
  let seller;

  let chance;
  let baseAmount
  let daiAmount
  let randomShareAmount
  let path;

  const salts = [
    ethers.encodeBytes32String('1'),
    ethers.encodeBytes32String('2'),
    ethers.encodeBytes32String('3'),
    ethers.encodeBytes32String('4'),
    ethers.encodeBytes32String('5')
  ];

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

    await deployments.fixture(["Shares", "DraggableShares", "PaymentHub", "Brokerbot", "MultiSigCloneFactory"]);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");

    // Set (manipulate local) balances (xchf,dai,wbtc) for first 5 accounts
    await setBalances(accounts, baseCurrency, daiContract, wbtcContract);

    //Mint shares to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await shares.connect(owner).mint(accounts[i], 2000000);
      await shares.connect(signers[i]).approve(await draggable.getAddress(), config.infiniteAllowance);
      await draggable.connect(signers[i]).wrap(accounts[i], 600000);
    }

    // Deposit some shares to Brokerbot
    await draggable.connect(owner).transfer(await brokerbot.getAddress(), 500000 );
    await baseCurrency.connect(owner).transfer(await brokerbot.getAddress(), ethers.parseEther("100000"));

    // appove base currency in payment hub
    await paymentHub.approveERC20(config.baseCurrencyAddress);
  });
  beforeEach(async () => {
    randomShareAmount = chance.natural({ min: 50, max: 500 });
    baseAmount = await brokerbot.getSellPrice(randomShareAmount);
  })

  describe("Selling against ERC20", () => {
    beforeEach(async () => {
      // set sig as seller
      seller = sig1;
      await draggable.connect(seller).approve(await paymentHub.getAddress(), config.infiniteAllowance);
    })
    it("Should sell against USDC", async () => {
      // path: XCHF -> USDC
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 500, config.usdcAddress];
      path = ethers.solidityPacked(types,values);
      const usdcAmount = await paymentHub.getPriceERC20.staticCall(baseAmount, path, false);
      //console.log(`xchfaumont: ${ethers.utils.formatUnits(baseAmount,18)}`);
      //console.log(`usdcAmount: ${ethers.utils.formatUnits(usdcAmount,6)}`);
      expect(parseFloat(ethers.formatUnits(usdcAmount,6))).to.be.above(parseFloat(ethers.formatUnits(baseAmount,18)));
      await draggable.connect(seller).approve(await paymentHub.getAddress(), config.infiniteAllowance);
      expect(await usdcContract.balanceOf(seller.address)).to.equal(0);
      // in real use case slippage should be considerered for usdcAmount (the miniminum out amount from the swap)
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: usdcAmount
      };
      await paymentHub.connect(seller).sellSharesAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, false);
      expect(await usdcContract.balanceOf(seller.address)).to.equal(usdcAmount)
    })

    it("Should sell against WETH", async () => {
      // path: XCHF -> WETH
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress];
      path = ethers.solidityPacked(types,values);
      const ethAmount = await paymentHub.getPriceERC20.staticCall(baseAmount, path, false);
      //console.log(`ethAmount: ${ethers.utils.formatEther(ethAmount)}`);
      expect(await wethContract.balanceOf(seller.address)).to.equal(0);
      // in real use case slippage should be considerered for ethAmount (the miniminum out amount from the swap)
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: ethAmount
      };
      await paymentHub.connect(seller).sellSharesAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, false);
      expect(await wethContract.balanceOf(seller.address)).to.equal(ethAmount);
    })
  })

  describe("Selling against ETH", () => {
    let ethAmount;
    beforeEach(async () => {
      // set sig as seller
      seller = sig1;
      // path: XCHF -> WETH
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress];
      path = ethers.solidityPacked(types,values);
      ethAmount = await paymentHub.getPriceERC20.staticCall(baseAmount, path, false);
    })
    it("Should sell against ETH", async () => {
      await draggable.connect(seller).approve(await paymentHub.getAddress(), config.infiniteAllowance);
      //console.log(`ethAmount: ${ethers.utils.formatEther(ethAmount)}`);
      const ethBalanceSellerBefore = await ethers.provider.getBalance(seller.address);
      // in real use case slippage should be considerered for ethAmount (the miniminum out amount from the swap)
      const unwrapWeth = true;
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: ethAmount
      };
      const txInfo = await paymentHub.connect(seller).sellSharesAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, unwrapWeth);
      const { gasPrice, cumulativeGasUsed} = await txInfo.wait();
      const gasCost = gasPrice * cumulativeGasUsed;
      const ethBalanceSellerAfter = await ethers.provider.getBalance(seller.address);
      expect(ethBalanceSellerAfter - ethBalanceSellerBefore).to.equal(ethAmount - gasCost);
      expect(await wethContract.balanceOf(await paymentHub.getAddress())).to.equal(0);
      expect(await ethers.provider.getBalance(await paymentHub.getAddress())).to.equal(0);
    })

  })
  describe("Check uninteded use", () => {
    beforeEach(async () => {
      // set sig as seller
      seller = sig1;
      await draggable.connect(seller).approve(await paymentHub.getAddress(), config.infiniteAllowance);
    })
    it("Should revert sell if path is empty", async () => {
      const types = [];
      const values = [];
      path = ethers.solidityPacked(types,values);
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: baseAmount
      };
      await expect(paymentHub.connect(seller).sellSharesAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, false))
        .to.be.revertedWith("slice_outOfBounds");
    })
    it("Should revert if path is invalid", async () => {
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.baseCurrencyAddress];
      path = ethers.solidityPacked(types,values);
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: baseAmount
      };
      await expect(paymentHub.connect(seller).sellSharesAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, false))
        .to.be.reverted;

    })
    it("Should revert if swap wasn't iniciated by seller", async () => {
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress];
      path = ethers.solidityPacked(types,values);
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: baseAmount
      };
      await expect(paymentHub.sellSharesAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, false))
        .to.be.revertedWithPanic(0x11);
        //.to.be.revertedWithCustomError(paymentHub, "PaymentHub_InvalidSender").withArgs(deployer.address);
    })
  })

  describe("Sell with multisig", () => {
    let multiSigClone;
    let chainid;
    let ownerWallet;
    before(async () => {
      const mnemonic = process.env.MNEMONIC;
      ownerWallet = ethers.Wallet.fromPhrase(mnemonic, "m/44'/60'/0'/0/1").connect(ethers.provider);
      chainid = (await ethers.provider.getNetwork()).chainId;
      const tx = await multiSigCloneFactory.create(ownerWallet.address, salts[1]);
      const { logs } = await tx.wait();
      const address = logs[1].args[0];
      multiSigClone = await ethers.getContractAt("MultiSigWalletMaster", address);
      // send some shares to multisig
      await draggable.connect(owner).transfer(multiSigClone.getAddress(), 500 );
      // set allowance from multisig
      const approveTxData = await draggable.approve.populateTransaction(await paymentHub.getAddress(), config.infiniteAllowance);
      const data = await ownerWallet.populateTransaction(approveTxData);
      const approveTx = await getTX(await draggable.getAddress(), data, multiSigClone, ownerWallet, chainid);
      await multiSigClone.execute(approveTx.nonce, approveTx.to, approveTx.value, approveTx.data, [approveTx.signature.v], [approveTx.signature.r], [approveTx.signature.s]);    
      // path: XCHF -> WETH
      const types = ["address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress];
      path = ethers.solidityPacked(types,values);
    });
    it("Should sell against ETH with multisig", async () => {
      ethAmount = await paymentHub.getPriceERC20.staticCall(baseAmount, path, false);
      const ethBalanceSellerBefore = await ethers.provider.getBalance(await multiSigClone.getAddress());
      const unwrapWeth = true;
      const params = {
        path: path,
        recipient: await multiSigClone.getAddress(),
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: ethAmount
      };
      const sellDataTX = await paymentHub.sellSharesAndSwap.populateTransaction(await brokerbot.getAddress(), await draggable.getAddress(), randomShareAmount, "0x01", params, unwrapWeth);
      const sellTx = await getTX(await paymentHub.getAddress(), sellDataTX, multiSigClone, ownerWallet, chainid);
      await multiSigClone.execute(sellTx.nonce, sellTx.to, sellTx.value, sellTx.data, [sellTx.signature.v], [sellTx.signature.r], [sellTx.signature.s]);
      const ethBalanceSellerAfter = await ethers.provider.getBalance(await multiSigClone.getAddress());
      expect(ethBalanceSellerAfter - ethBalanceSellerBefore).to.equal(ethAmount);
    });
  })

})