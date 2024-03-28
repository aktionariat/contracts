const { ethers } = require("hardhat");
const { expect } = require("chai");
const { SignatureTransfer, permitTransferFromWithWitnessType } = require("@uniswap/permit2-sdk");
const { getBlockTimeStamp, giveApproval, setBalance, allowanceType, getConfigPath } = require("./helper/index");
const { SignatureTransferIntent, TradeIntent, MockIntent} = require("./helper/intent.js");

// Shared  Config
const config = require(`..${getConfigPath()}`);
// const config = require("../scripts/deploy_config_mainnet.js");

describe("Trade Reactor", () => {
  let draggable;
  let shares;
  let permit2Hub;
  let offerFactory;
  let allowlistShares;
  let allowlistDraggable;
  let brokerbot;
  let signatureTransfer;
  let tradeReactor;
  let zchfContract;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let chainid;
  let seller;
  let buyer;
  let issuer;
  let offramper;
  let offRampSeller;
  let backend;


  before(async() => {
    chainid = (await ethers.provider.getNetwork()).chainId;
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5,sig6] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    seller = sig2;
    buyer = sig3;
    issuer = sig4;
    offramper = sig5;
    offRampSeller = sig6;
    backend = sig1;
  });

  beforeEach(async() => {
    // get deployments
    await deployments.fixture(["SignatureTransfer", "TradeReactor", "Shares", "DraggableShares", "BrokerbotZCHF"]);
    signatureTransfer = await ethers.getContract("SignatureTransfer");
    // signatureTransfer = "0x46d4674578a2daBbD0CEAB0500c6c7867999db34";
    tradeReactor = await ethers.getContract("TradeReactor");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("BrokerbotZCHF");
    if (config.chainId == 137) {
      zchfContract = await ethers.getContractAt("IERC20MetaTx", config.zchfAddress);
    } else {
      zchfContract = await ethers.getContractAt("ERC20PermitLight", config.zchfAddress);
    }

    // TODO: look to move the stuff in helper/index.js
    //Mint shares to first 5 accounts
    for( let i = 0; i < accounts.length; i++) {
      await shares.connect(owner).mint(accounts[i], 1000000);
    }
    await setBalance(zchfContract, config.zchfBalanceSlot, accounts);

    // Deposit some shares/zchf to Brokerbot
    await shares.connect(owner).transfer(await brokerbot.getAddress(), 500000);
    await zchfContract.connect(owner).transfer(await brokerbot.getAddress(), ethers.parseEther("100000"));

    // give max approval to signature transfer contract for shares
    await giveApproval(chainid, shares, seller, await signatureTransfer.getAddress(), ethers.MaxUint256, allowanceType.PERMIT);
    if (config.chainId == 137) {
      await giveApproval(chainid, zchfContract, seller, await signatureTransfer.getAddress(), ethers.MaxUint256, allowanceType.METATX);
      await giveApproval(chainid, zchfContract, buyer, await signatureTransfer.getAddress(), ethers.MaxUint256, allowanceType.METATX);
    } else {
      await giveApproval(chainid, zchfContract, seller, await signatureTransfer.getAddress(), ethers.MaxUint256, allowanceType.PERMIT);
      await giveApproval(chainid, zchfContract, buyer, await signatureTransfer.getAddress(), ethers.MaxUint256, allowanceType.PERMIT);
    }
  });

  describe("Deployment", () => {
    it("Should depoly signature transfer contract", async() => {
      expect(await signatureTransfer.getAddress()).to.exist;
    })

    it("Should depoly reactor contract", async() => {
      expect(await tradeReactor.getAddress()).to.exist;
    })

    it("Should have signature transfer contract set", async() =>{
      expect(await tradeReactor.transfer()).to.be.equal(await signatureTransfer.getAddress());
    });
  });

  describe("Signature Transfer", () => {
    let permitData;
    let signature;
    const permitAmount = 10;
    beforeEach(async() => {
      const intent = new SignatureTransferIntent(await shares.getAddress(), backend.address, permitAmount);
      ({permitData, signature} = await intent.signIntent(signatureTransfer, seller));
    })
    it("Should transfer tokens via signature", async() => {
    const transferDetails = {
      to: backend.address,
      requestedAmount:  permitAmount,
    };
    const backendBalanceBefore = await shares.balanceOf(backend.address);
    await signatureTransfer.connect(backend).permitTransferFrom(permitData.values, transferDetails, seller.address, signature);
    const backendBalanceAfter = await shares.balanceOf(backend.address);
    expect(backendBalanceAfter - backendBalanceBefore).to.equal(permitAmount);
    });
    
    it("Should allow multiple partial fills up to the max permitted amount", async() => {
      const transferDetails = {
        to: backend.address,
        requestedAmount:  permitAmount / 2,
      };
      const backendBalanceBefore = await shares.balanceOf(backend.address);
      // first partial fill
      await signatureTransfer.connect(backend).permitTransferFrom(permitData.values, transferDetails, seller.address, signature);
      const backendBalanceAfterFirstFill = await shares.balanceOf(backend.address);
      expect(backendBalanceAfterFirstFill - backendBalanceBefore).to.equal(permitAmount / 2);
      // revert if partial fill exceeds max
      const transferDetailsOverfill = {
        to: backend.address,
        requestedAmount:  permitAmount + 1,
      };
      await expect(signatureTransfer.connect(backend).permitTransferFrom(permitData.values, transferDetailsOverfill, seller.address, signature))
        .to.be.revertedWithCustomError(signatureTransfer, "OverFilled");
      // second fill
      await signatureTransfer.connect(backend).permitTransferFrom(permitData.values, transferDetails, seller.address, signature);
      const backendBalanceAfterSecondFill = await shares.balanceOf(backend.address);
      expect(backendBalanceAfterSecondFill - backendBalanceAfterFirstFill).to.equal(permitAmount / 2);
      // revert if alrdeay was fully filled
      await expect(signatureTransfer.connect(backend).permitTransferFrom(permitData.values, transferDetails, seller.address, signature))
        .to.be.revertedWithCustomError(signatureTransfer, "InvalidNonce");
    });
  });

  describe("Procces", () => {
    it("Should process intents", async() => {
      // create intents
      // sell intent
      const sellAmount = 100;
      const sellPrice = 1000;
      const sellIntent = new TradeIntent(
        seller.address, // owner
        issuer.address, // filler
        await shares.getAddress(), // tokenOut
        sellAmount, // amountOut
        await zchfContract.getAddress(), // tokenIn
        sellPrice, // amountIn
        1, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // buy intent
      const buyAmount = 100;
      const buyPrice = 1000;
      const buyIntent = new TradeIntent(
        buyer.address, // owner
        issuer.address, // filler
        await zchfContract.getAddress(), // tokenOut
        buyPrice, // amountOut
        await shares.getAddress(), // tokenIn
        buyAmount, // amountIn
        2, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // sign intents
      const {intent: signedSellIntent, signature: signatureSeller} = await sellIntent.signIntent(signatureTransfer, await tradeReactor.getAddress(), seller);
      const {intent: signedBuyIntent, signature: signatureBuyer} = await buyIntent.signIntent(signatureTransfer, await tradeReactor.getAddress(), buyer);
      // process intents by calling process in tradereactor.sol
      const sellerBaseBefore = await zchfContract.balanceOf(seller.address);
      await tradeReactor.connect(issuer).process(backend.address, sellIntent, signatureSeller, buyIntent, signatureBuyer);
      const sellerBaseAfter = await zchfContract.balanceOf(seller.address);
      expect(sellerBaseAfter - sellerBaseBefore).to.equal(sellPrice);
      // move token base currency to offramp
      // 1. sign signature transfer
      const offrampIntent = new SignatureTransferIntent(await zchfContract.getAddress(), offramper.address, sellPrice).withNonce(2);
      const {permitData, signature} = await offrampIntent.signIntent(signatureTransfer, seller);
      // 2. execute signature tranfer
      const transferDetails = {
        to: offRampSeller.address,
        requestedAmount:  sellPrice,
      };
      const offrampSellerBalanceBefore = await zchfContract.balanceOf(offRampSeller.address);
      await signatureTransfer.connect(offramper).permitTransferFrom(permitData.values, transferDetails, seller.address, signature);
      const offrampSellerBalanceAfter = await zchfContract.balanceOf(offRampSeller.address);
      expect(offrampSellerBalanceAfter - offrampSellerBalanceBefore).to.be.equal(sellPrice);
    })

    it("Should process partiall filling", async() => {
      // create intents
      // sell intent
      const sellAmount = 100;
      const sellPrice = 1000;
      const sellIntent = new TradeIntent(
        seller.address, // owner
        issuer.address, // filler
        await shares.getAddress(), // tokenOut
        sellAmount, // amountOut
        await zchfContract.getAddress(), // tokenIn
        sellPrice, // amountIn
        2, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // buy intent
      const buyAmount1 = 50;
      const buyPrice1 = 500;
      const buyIntent1 = new TradeIntent(
        buyer.address, // owner
        issuer.address, // filler
        await zchfContract.getAddress(), // tokenOut
        buyPrice1, // amountOut
        await shares.getAddress(), // tokenIn
        buyAmount1, // amountIn
        3, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // buy intent 2
      const buyAmount2 = 50;
      const buyPrice2 = 500;
      const buyIntent2 = new TradeIntent(
        buyer.address, // owner
        issuer.address, // filler
        await zchfContract.getAddress(), // tokenOut
        buyPrice2, // amountOut
        await shares.getAddress(), // tokenIn
        buyAmount2, // amountIn
        4, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // sign intents
      const {intent: signedSellIntent, signature: signatureSeller} = await sellIntent.signIntent(signatureTransfer, await tradeReactor.getAddress(), seller);
      const {intent: signedBuyIntent1, signature: signatureBuyer1} = await buyIntent1.signIntent(signatureTransfer, await tradeReactor.getAddress(), buyer);
      const {intent: signedBuyIntent2, signature: signatureBuyer2} = await buyIntent2.signIntent(signatureTransfer, await tradeReactor.getAddress(), buyer);
      // process 1st filling
      const sellerBaseBefore = await zchfContract.balanceOf(seller.address);
      const tradeReactorIssuer = await tradeReactor.connect(issuer);
      // await tradeReactorIssuer["process(address,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,uint256)"](backend.address, sellIntent, signatureSeller, buyIntent1, signatureBuyer1, buyAmount1);
      await tradeReactor.connect(issuer).process(backend.address, sellIntent, signatureSeller, buyIntent1, signatureBuyer1);
      const sellerBaseAfter = await zchfContract.balanceOf(seller.address);
      expect(sellerBaseAfter - sellerBaseBefore).to.equal(buyPrice1);
      // process 2nd filling
      const sellerBaseBefore2 = await zchfContract.balanceOf(seller.address);
      // await tradeReactorIssuer["process(address,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,uint256)"](backend.address, sellIntent, signatureSeller, buyIntent2, signatureBuyer2, buyAmount2);
      await tradeReactor.connect(issuer).process(backend.address, sellIntent, signatureSeller, buyIntent2, signatureBuyer2);
      const sellerBaseAfter2 = await zchfContract.balanceOf(seller.address);
      expect(sellerBaseAfter2 - sellerBaseBefore2).to.equal(buyPrice2);
    })

    it("Should process partiall filling with custom amount", async () => {
       // create intents
      // sell intent
      const sellAmount = 100;
      const sellPrice = 1000;
      const sellIntent = new TradeIntent(
        seller.address, // owner
        issuer.address, // filler
        await shares.getAddress(), // tokenOut
        sellAmount, // amountOut
        await zchfContract.getAddress(), // tokenIn
        sellPrice, // amountIn
        2, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // buy intent
      const buyAmount1 = 50;
      const buyPrice1 = 500;
      const buyIntent1 = new TradeIntent(
        buyer.address, // owner
        issuer.address, // filler
        await zchfContract.getAddress(), // tokenOut
        buyPrice1, // amountOut
        await shares.getAddress(), // tokenIn
        buyAmount1, // amountIn
        3, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // buy intent 2
      const buyAmount2 = 50;
      const buyPrice2 = 500;
      const buyIntent2 = new TradeIntent(
        buyer.address, // owner
        issuer.address, // filler
        await zchfContract.getAddress(), // tokenOut
        buyPrice2, // amountOut
        await shares.getAddress(), // tokenIn
        buyAmount2, // amountIn
        4, // nonce
        ethers.toUtf8Bytes("") // data
      );
      // sign intents
      const {intent: signedSellIntent, signature: signatureSeller} = await sellIntent.signIntent(signatureTransfer, await tradeReactor.getAddress(), seller);
      const {intent: signedBuyIntent1, signature: signatureBuyer1} = await buyIntent1.signIntent(signatureTransfer, await tradeReactor.getAddress(), buyer);
      const {intent: signedBuyIntent2, signature: signatureBuyer2} = await buyIntent2.signIntent(signatureTransfer, await tradeReactor.getAddress(), buyer);
      // process 1st filling
      const customAmount1 = 10;
      const sellerBaseBefore = await zchfContract.balanceOf(seller.address);
      const tradeReactorIssuer = await tradeReactor.connect(issuer);
      await tradeReactorIssuer["process(address,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,uint256)"](backend.address, sellIntent, signatureSeller, buyIntent1, signatureBuyer1, customAmount1);
      const sellerBaseAfter = await zchfContract.balanceOf(seller.address);
      expect(sellerBaseAfter - sellerBaseBefore).to.equal(customAmount1*10);
      // process 2nd filling
      const customAmount2 = 20;
      const sellerBaseBefore2 = await zchfContract.balanceOf(seller.address);
      await tradeReactorIssuer["process(address,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,(address,address,address,uint160,address,uint160,uint48,uint48,bytes),bytes,uint256)"](backend.address, sellIntent, signatureSeller, buyIntent2, signatureBuyer2, customAmount2);
      const sellerBaseAfter2 = await zchfContract.balanceOf(seller.address);
      expect(sellerBaseAfter2 - sellerBaseBefore2).to.equal(customAmount2*10);
    })
  })

  describe("Buy from Brokerbot", () => {
    it("Should use intent to buy from brokerbot", async() => {
      // get prize at brokerbot
      const buyAmount1 = 50;
      const buyPrize1 = await brokerbot.getBuyPrize()
      // buy intent
      const buyIntent1 = new TradeIntent(
        buyer.address, // owner
        issuer.address, // filler
        await zchfContract.getAddress(), // tokenOut
        buyPrice1, // amountOut
        await shares.getAddress(), // tokenIn
        buyAmount1, // amountIn
        5, // nonce
        ethers.toUtf8Bytes("") // data
      );
      const {intent: signedBuyIntent1, signature: signatureBuyer1} = await buyIntent1.signIntent(signatureTransfer, await tradeReactor.getAddress(), buyer);
      const tradeReactorIssuer = await tradeReactor.connect(issuer);
      tradeReactorIssuer.buyFromBrokerbot(await brokerbot.getAddress(), buyIntent1, signatureBuyer1, buyPrice1);
    })
  })
});
