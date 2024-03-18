const { ethers } = require("hardhat");
const { expect } = require("chai");
const { SignatureTransfer, permitTransferFromWithWitnessType } = require("@uniswap/permit2-sdk");
const { getBlockTimeStamp, giveApproval, setBalance } = require("./helper/index");
const { SignatureTransferIntent, TradeIntent, MockIntent} = require("./helper/intent.js");

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Trade Reactor", () => {
  let draggable;
  let shares;
  let permit2Hub;
  let offerFactory;
  let allowlistShares;
  let allowlistDraggable;
  let signatureTransfer;
  let tradeReactor;
  let baseCurrency;

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
    await deployments.fixture(["SignatureTransfer", "TradeReactor", "Shares", "DraggableShares"]);
    signatureTransfer = await ethers.getContract("SignatureTransfer");
    // signatureTransfer = "0x46d4674578a2daBbD0CEAB0500c6c7867999db34";
    tradeReactor = await ethers.getContract("TradeReactor");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);

    // TODO: look to move the stuff in helper/index.js
    //Mint shares to first 5 accounts
    for( let i = 0; i < accounts.length; i++) {
      await shares.connect(owner).mint(accounts[i], 1000000);
    }
    await setBalance(baseCurrency, config.baseCurrencyBalanceSlot, accounts);

    // give max approval to signature transfer contract for shares
    await giveApproval(shares, seller, await signatureTransfer.getAddress(), ethers.MaxUint256);
    await giveApproval(baseCurrency, seller, await signatureTransfer.getAddress(), ethers.MaxUint256);
    await giveApproval(baseCurrency, buyer, await signatureTransfer.getAddress(), ethers.MaxUint256);
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

    it.skip("Should transfer with mock witness", async() => {
      const transferDetails = {
        to: backend.address,
        requestedAmount:  permitAmount,
      };
      const permit = {
        permitted: {
          token: await shares.getAddress(),
          amount: permitAmount,
        },
        nonce: 0,
        deadline: Math.floor(Date.now() /  1000) +  60 *  60
      };
      const sellIntent = new MockIntent(await shares.getAddress(), permitAmount);
      const {intent: signedSellIntent, signature: signatureSeller, hash: sellerHash} = await sellIntent.signIntent(signatureTransfer, backend.address, seller);
      const witnessTypeString = "MockWitness witness)MockWitness(uint256 mock)TokenPermissions(address token,uint256 amount)";
      const backendBalanceBefore = await shares.balanceOf(backend.address);
      console.log(sellerHash);
      await signatureTransfer.connect(backend).permitWitnessTransferFrom(
        permit, // permit
        transferDetails, // transferDetails
        seller.address, // owner
        sellerHash, // witness
        witnessTypeString, // witnessTypeString
        signatureSeller // signature
        );
      const backendBalanceAfter = await shares.balanceOf(backend.address);
      expect(backendBalanceAfter - backendBalanceBefore).to.equal(permitAmount);
    })

    it.skip("Should transfer with witness", async() => {
      const transferDetails = {
        to: backend.address,
        requestedAmount:  permitAmount,
      };
      const permit = {
        permitted: {
          token: await shares.getAddress(),
          amount: permitAmount,
        },
        nonce: 0,
        deadline: Math.floor(Date.now() /  1000) +  60 *  60
      };

      // sell intent
      const sellAmount = 100;
      const sellPrice = 1000;
      const sellIntent = new TradeIntent(
        seller.address, // owner
        issuer.address, // filler
        await shares.getAddress(), // tokenOut
        sellAmount, // amountOut
        await baseCurrency.getAddress(), // tokenIn
        sellPrice, // amountIn
        0, // nonce
        "0x01" // data
      );
      const {intent: signedSellIntent, signature: signatureSeller, hash: sellerHash} = await sellIntent.signIntent(signatureTransfer, issuer.address, seller);
      console.log(signedSellIntent.types.IntentWitness);
      console.log(signedSellIntent.values.witness);
      console.log(signedSellIntent.types.TokenPermissions);
      const witnessTypes = ["address", "address", "address", "uint160", "address", "uint160", "uint48", "uint48", "bytes"];
      const witnessValues = [sellIntent.owner, sellIntent.filler, sellIntent.tokenOut, sellIntent.amountOut, sellIntent.tokenIn, sellIntent.amountIn, sellIntent.expiration, sellIntent.nonce, sellIntent.data];
      const witnessPacked = ethers.solidityPacked(witnessTypes, witnessValues);
      const witness = ethers.keccak256(witnessPacked);
      const witnessTypeString = "Intent witness)Intent(address owner,address filler,address tokenOut,uint160 amountOut,address tokenIn,uint160 amountIn,uint48 expiration,uint48 noncebytes data)TokenPermissions(address token,uint256 amount)";
      const backendBalanceBefore = await shares.balanceOf(backend.address);
      await signatureTransfer.connect(issuer).permitWitnessTransferFrom(
        permit, // permit
        transferDetails, // transferDetails
        seller.address, // owner
        sellerHash, // witness
        witnessTypeString, // witnessTypeString
        signatureSeller // signature
        );
      const backendBalanceAfter = await shares.balanceOf(backend.address);
      expect(backendBalanceAfter - backendBalanceBefore).to.equal(permitAmount);
    });
  });

  describe("Reactor", () => {
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
        await baseCurrency.getAddress(), // tokenIn
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
        await baseCurrency.getAddress(), // tokenOut
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
      const sellerBaseBefore = await baseCurrency.balanceOf(seller.address);
      await tradeReactor.connect(issuer).process(backend.address, sellIntent, signatureSeller, buyIntent, signatureBuyer);
      const sellerBaseAfter = await baseCurrency.balanceOf(seller.address);
      expect(sellerBaseAfter - sellerBaseBefore).to.equal(sellPrice);
      // move token base currency to offramp
      // 1. sign signature transfer
      const offrampIntent = new SignatureTransferIntent(await baseCurrency.getAddress(), offramper.address, sellPrice).withNonce(2);
      const {permitData, signature} = await offrampIntent.signIntent(signatureTransfer, seller);
      // 2. execute signature tranfer
      const transferDetails = {
        to: offRampSeller.address,
        requestedAmount:  sellPrice,
      };
      const offrampSellerBalanceBefore = await baseCurrency.balanceOf(offRampSeller.address);
      await signatureTransfer.connect(offramper).permitTransferFrom(permitData.values, transferDetails, seller.address, signature);
      const offrampSellerBalanceAfter = await baseCurrency.balanceOf(offRampSeller.address);
      expect(offrampSellerBalanceAfter - offrampSellerBalanceBefore).to.be.equal(sellPrice);
    })
  })
});