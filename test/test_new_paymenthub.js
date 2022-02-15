const {network, ethers, deployments, } = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { encodeRouteToPath } = require("@uniswap/v3-sdk");

const { mintBaseCurrency, mintERC20, setBalance } = require("./helper/index");

// Shared  Config
const config = require("../scripts/deploy_config.js");
const { wbtcAddress } = require("../scripts/deploy_config.js");

describe("New PaymentHub", () => {
  const ethersProvider = new ethers.providers.Web3Provider(network.provider);
  const router = new AlphaRouter({ chainId: 1, provider: ethersProvider });
  const WETH = new Token(
    1,
    config.wethAddress,
    18,
    'WETH',
    'Wrapped Ether'
  );

  const DAI = new Token(
    1,
    config.daiAddress,
    18,
    'DAI',
    'DAI'
  );

  const XCHF = new Token(
    1,
    config.baseCurrencyAddress,
    18,
    'XCHF',
    'CryptoFranc'
  );

  const WBTC = new Token(
    1,
    config.wbtcAddress,
    8,
    "WBTC",
    "Wrapped Bitcoin"
  );


  let draggable;
  let shares;
  let baseCurrency;
  let paymentHub;
  let offerFactory;
  let allowlistShares;
  let allowlistDraggable;
  let brokerbot;
  let brokerbotDAI;
  let daiContract;
  let wbtcContract;

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
  let name;
  let symbol;
  let terms;
  let dterms;
  let xchfamount
  let daiAmount
  let randomShareAmount
  let path;

  const TYPE_DEFAULT = 0;
  const TYPE_ALLOWLISTED = 1;
  const TYPE_FORBIDDEN = 2;
  const TYPE_POWERLISTED = 3;

  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    chance = new Chance();

    // random test data with chance
    name = chance.sentence({words: 3});
    symbol = chance.word({length: chance.natural({min: 1, max: 5})}).toUpperCase();
    terms = chance.word({length: chance.natural({min: 1, max: 10})});
    dterms = chance.word({length: chance.natural({min: 1, max: 10})});

    // deploy contracts
    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);
    daiContract = await ethers.getContractAt("ERC20Basic", config.daiAddress);
    wbtcContract = await ethers.getContractAt("ERC20Basic", config.wbtcAddress)

    await deployments.fixture(["Shares", "PaymentHub", "Brokerbot", "BrokerbotDAI"]);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotDAI = await ethers.getContract("BrokerbotDAI");

    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    //await mintERC20(forceSend, baseCurrency, config.baseCurrencyMinterAddress, accounts);
    await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);
    // Set (manipulate local) DAI balance for first 5 accounts
    await setBalance(daiContract, config.daiBalanceSlot, accounts);
    // Set (manipulate local) WBTC balance for first 5 accounts
    await setBalance(wbtcContract, config.wbtcBalanceSlot, accounts);

    //Mint shares to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await shares.connect(owner).mint(accounts[i], 1000000);
    }

    // Deposit some shares to Brokerbot
    await shares.connect(owner).transfer(brokerbot.address, 500000 );
    await shares.connect(owner).transfer(brokerbotDAI.address, 500000);
    await baseCurrency.connect(owner).transfer(brokerbot.address, ethers.utils.parseEther("100000"));
  });

  describe("Deployment", () => {
    describe("PaymentHub", () => {
      it("Should deploy contract", async () => {
        expect(paymentHub.address).to.exist;
      });
    });

    describe("BrokerBot", () => {
      it("Should deploy contract", async () => {
        expect(brokerbot.address).to.exist;
      });
    });
  });

  describe("Trading", () => {
    beforeEach(async () => {
      const randomAmount = chance.natural({ min: 500, max: 50000 });
      xchfamount = await brokerbot.getBuyPrice(randomAmount);
    });
    it("Should get price in ETH", async () => {
      const priceeth = await paymentHub.getLatestPriceETHUSD();
      // console.log(await priceeth.toString());
      
      const priceInETH = await paymentHub.getPriceInEtherFromOracle(ethers.utils.parseEther("1000"), await brokerbot.base());
      // rework to not use static value
      expect(await ethers.utils.formatEther(priceInETH)).to.equal("0.244787563584463807")
    });

    it("Should buy shares with ETH and trade it to XCHF", async () => {
      const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](xchfamount, brokerbot.address);

      // send a little bit more for slippage 
      const priceInETHWithSlippage = priceInETH.mul(101).div(100);

      const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
      await paymentHub.connect(sig1).payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: priceInETHWithSlippage});
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);

      // brokerbot should have after the payment with eth the xchf in the balance
      expect(brokerbotBalanceBefore.add(xchfamount)).to.equal(brokerbotBalanceAfter);
    });

    it("Should set setting for keeping ETH", async () => {
      const settingKeepETh = config.KEEP_ETHER;
      const settingsBefore = await brokerbot.settings();

      // new setting with combination of old setting plus keep ETH
      const newSetting = settingsBefore.xor(settingKeepETh);

      await brokerbot.connect(owner).setSettings(newSetting);
      const settingsAfter = await brokerbot.settings();

      expect(settingsAfter).to.not.equal(settingsBefore);
      expect(settingsAfter).to.equal(newSetting);
    });

    it("Should revert if buy with ETH and send to less ETH", async () => {
      const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](xchfamount, brokerbot.address);
      const lowerPriceInETH = priceInETH.mul(90).div(100);
      await expect(paymentHub.connect(sig1).payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: lowerPriceInETH})).to.be.reverted;
    });

    it("Should buy shares with ETH and keep ETH", async () => {
      const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](xchfamount, brokerbot.address);
      // console.log(await ethers.utils.formatEther(priceInETH));
      // console.log(await priceInETH.toString());

      // overpay in eth to test payback
      const pricePlus = priceInETH.mul(110).div(100);

      const brokerbotETHBefore = await ethers.provider.getBalance(brokerbot.address);
      const buyerETHBefore = await ethers.provider.getBalance(sig1.address);
      const tx = await paymentHub.connect(sig1).payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: pricePlus});
      const { effectiveGasPrice, cumulativeGasUsed} = await tx.wait();
      // get how much eth was paid for tx
      const gasPaid = effectiveGasPrice.mul(cumulativeGasUsed);
      const brokerbotETHAfter = await ethers.provider.getBalance(brokerbot.address);
      const buyerETHAfter = await ethers.provider.getBalance(sig1.address);
      // console.log(await ethers.utils.formatEther(brokerbotETHAfter));
      // brokerbot balance only increase priceInETH not pricePlus -> correct eth is send to brokerbot
      expect(brokerbotETHBefore.add(priceInETH)).to.equal(brokerbotETHAfter);
      // buyer balance decrease in gas paid for tx + priceInETH -> overpaid eth is send back
      expect(buyerETHBefore.sub(priceInETH).sub(gasPaid)).to.equal(buyerETHAfter);
    });

    it("Should be able to withdraw ETH from brokerbot as owner", async () => {
      const brokerbotETHBefore = await ethers.provider.getBalance(brokerbot.address);
      const ownerETHBefore = await ethers.provider.getBalance(owner.address);
      await expect(brokerbot.withdrawEther(brokerbotETHBefore)).to.be.revertedWith("not owner nor hub");
      await expect(brokerbot.connect(owner).withdrawEther(brokerbotETHBefore.add(1))).to.be.revertedWith("Transfer failed.");     
      await brokerbot.connect(owner).withdrawEther(brokerbotETHBefore);
      const brokerbotETHAfter = await ethers.provider.getBalance(brokerbot.address);
      const ownerETHAfter = await ethers.provider.getBalance(owner.address);
      expect(brokerbotETHAfter.isZero()).to.be.true;
      expect(ownerETHAfter).to.be.above(ownerETHBefore);
    });

    it("Should be able to recover token sent to paymenthub", async () => {
      const wrongSent = chance.natural({ min: 1, max: 500 });
      const balBefore = await baseCurrency.balanceOf(sig1.address);
      await baseCurrency.connect(sig1).transfer(paymentHub.address, wrongSent);
      const balInbetween = await baseCurrency.balanceOf(sig1.address);
      expect(balBefore.sub(wrongSent)).to.equal(balInbetween);
      await paymentHub.connect(sig1).recover(baseCurrency.address, sig1.address, wrongSent);
      const balInAfter = await baseCurrency.balanceOf(sig1.address);
      expect(balBefore).to.equal(balInAfter);

    });
  });

  describe("Trading with DAI base", () => {
    beforeEach(async () => {
      const randomAmount = chance.natural({ min: 500, max: 5000 });
      daiAmount = await brokerbotDAI.getBuyPrice(randomAmount);
    });
    it("Should get right ETH price ", async () => {
      const priceeth = await paymentHub.getLatestPriceETHUSD();
      // console.log(await priceeth.toString());
      // console.log(await daiAmount.toString());
      const priceInETH = await paymentHub.getPriceInEtherFromOracle(daiAmount, brokerbotDAI.address);
      await expect(ethers.utils.formatEther(priceInETH)).to.equal(
        ethers.utils.formatEther(daiAmount.mul(await ethers.BigNumber.from(10).pow(8)).div(priceeth)));
    });

    it("Should buy shares with ETH and trade it to DAI", async () => {
      const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](daiAmount, brokerbotDAI.address);

      // send a little bit more for slippage
      const priceInETHWithSlippage = priceInETH.mul(101).div(100);

      const brokerbotBalanceBefore = await daiContract.balanceOf(brokerbotDAI.address);
      await paymentHub.connect(sig1).payFromEtherAndNotify(brokerbotDAI.address, daiAmount, "0x01", {value: priceInETHWithSlippage});
      const brokerbotBalanceAfter = await daiContract.balanceOf(brokerbotDAI.address);

      // brokerbot should have after the payment with eth the dai in the balance
      expect(brokerbotBalanceBefore.add(daiAmount)).to.equal(brokerbotBalanceAfter);
    });

    it("Should buy shares and pay with DAI", async () => {
      // allowance for DAI
      await daiContract.connect(sig1).approve(paymentHub.address, daiAmount);

      const brokerbotBalanceBefore = await daiContract.balanceOf(brokerbotDAI.address);
      //await paymentHub.connect(sig1).payAndNotify(brokerbotDAI.address, daiAmount, "0x01");
      const paymentHubAdr1 = await paymentHub.connect(sig1);
      await paymentHubAdr1["payAndNotify(address,uint256,bytes)"](brokerbotDAI.address, daiAmount, "0x01");
      const brokerbotBalanceAfter = await daiContract.balanceOf(brokerbotDAI.address);

      // brokerbot should have after the payment with eth the dai in the balance
      expect(brokerbotBalanceBefore.add(daiAmount)).to.equal(brokerbotBalanceAfter);
    });
  });

  describe("Trading ERC20 with XCHF base", () => {
    before(async () => {
      randomShareAmount = chance.natural({ min: 500, max: 50000 });
      xchfamount = await brokerbot.getBuyPrice(randomShareAmount);
      const types = ["address","uint24","address","uint24","address"];
      const values = [config.baseCurrencyAddress, 3000, config.wethAddress, 500, config.wbtcAddress];
      path = ethers.utils.solidityPack(types,values);
    });

    it("Should get price in WBTC via ETH", async () => {
      const price = await paymentHub.callStatic["getPriceInERC20(uint256,bytes)"](xchfamount, path);
      //console.log(await ethers.utils.formatEther(price));
      expect(price).to.be.above(0);
    });

    it("Should buy shares with WBTC and trade it to XCHF", async () => {
      const base = await brokerbot.base();
      //approve WBTC in the paymenthub
      await paymentHub.approveERC20(config.wbtcAddress);

      // get approximate price
      const priceInWBTC = await paymentHub.callStatic["getPriceInERC20(uint256,bytes)"](xchfamount, path);

      // little bit more for slippage
      const priceInWBTCWithSlippage = priceInWBTC.mul(101).div(100);

      // approve wbtc for the user
      await wbtcContract.connect(sig1).approve(paymentHub.address, priceInWBTCWithSlippage);

      //trade and log balance change
      const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
      const sharesBefore = await shares.balanceOf(sig1.address);
      //console.log("before: %s", await ethers.utils.formatEther(brokerbotBalanceBefore));
      await paymentHub.connect(sig1).payFromERC20AndNotify(brokerbot.address, xchfamount, wbtcContract.address, priceInWBTCWithSlippage, path, "0x01");
      const sharesAfter = await shares.balanceOf(sig1.address);
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
      //console.log("after: %s", await ethers.utils.formatEther(brokerbotBalanceAfter));

      // brokerbot should have after the payment with eth the xchf in the balance
      expect(brokerbotBalanceBefore.add(xchfamount)).to.equal(brokerbotBalanceAfter);

      // user should get the amount of shares
      expect(sharesBefore.add(randomShareAmount)).to.equal(sharesAfter);

      // allowance for payment - uniswaprouter is infinit and always above 0
      expect(await wbtcContract.allowance(paymentHub.address, "0xE592427A0AEce92De3Edee1F18E0157C05861564")).to.be.above(0);
    });
  });

  describe("Trading ERC20 with DAI base", () => {
    before(async () => {
      randomShareAmount = chance.natural({ min: 500, max: 50000 });
      daiAmount = await brokerbotDAI.getBuyPrice(randomShareAmount);
      // get best route via auto router
      const daiCurrencyAmount = CurrencyAmount.fromRawAmount(DAI, daiAmount);
      const route = await router.route(
        daiCurrencyAmount,
        XCHF,
        TradeType.EXACT_OUTPUT,
        {
          recipient: sig1.address,
          slippageTolerance: new Percent(5, 100),
          deadline: 100
        }
      );

      path = encodeRouteToPath(route.route[0].route, true);
    });
    it("Should get price in XCHF to DAI auto route", async () => {
      const price = await paymentHub.callStatic["getPriceInERC20(uint256,bytes)"](daiAmount, path);
      // console.log(ethers.utils.formatEther(daiAmount));
      // console.log(ethers.utils.formatEther(price));
      expect(price).to.be.above(0);
    });

    it("Should buy shares with XCHF and trade it to DAI", async () => {
      //approve XCHF in the paymenthub
      await paymentHub.approveERC20(config.baseCurrencyAddress);

      // get approximate price
      const priceInXCHF = await paymentHub.callStatic["getPriceInERC20(uint256,bytes)"](daiAmount, path);

      // little bit more for slippage
      const priceInXCHFWithSlippage = priceInXCHF.mul(101).div(100);

      // approve xchf for the user
      await baseCurrency.connect(sig1).approve(paymentHub.address, priceInXCHFWithSlippage);

      //trade and log balance change
      const brokerbotBalanceBefore = await daiContract.balanceOf(brokerbotDAI.address);
      const sharesBefore = await shares.balanceOf(sig1.address);
      //console.log("before: %s", await ethers.utils.formatEther(brokerbotBalanceBefore));
      await paymentHub.connect(sig1).payFromERC20AndNotify(brokerbotDAI.address, daiAmount, baseCurrency.address, priceInXCHFWithSlippage, path, "0x01");
      const sharesAfter = await shares.balanceOf(sig1.address);
      const brokerbotBalanceAfter = await daiContract.balanceOf(brokerbotDAI.address);
      //console.log("after: %s", await ethers.utils.formatEther(brokerbotBalanceAfter));

      // brokerbot should have after the payment with eth the xchf in the balance
      expect(brokerbotBalanceBefore.add(daiAmount)).to.equal(brokerbotBalanceAfter);

      // user should get the amount of shares
      expect(sharesBefore.add(randomShareAmount)).to.equal(sharesAfter);

      // allowance for payment - uniswaprouter is infinit and always above 0
      expect(await baseCurrency.allowance(paymentHub.address, "0xE592427A0AEce92De3Edee1F18E0157C05861564")).to.be.above(0);
    });

  });
});
