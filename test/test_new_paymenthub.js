const {network, ethers, deployments, } = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");
const { mintBaseCurrency, mintERC20, setBalance } = require("./helper/index");  

// Shared  Config
const config = require("../scripts/deploy_config.js");
const { wbtcAddress } = require("../scripts/deploy_config.js");

describe("New PaymentHub", () => {
  let draggable;
  let shares;
  let baseCurrency;
  let paymentHub;
  let forceSend;
  let brokerbot;
  let brokerbotDAI;
  let daiContract;
  let wbtcContract;

  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let accounts;
  let signers;
  let oracle;

  let chance;
  let name;
  let symbol;
  let terms;
  let dterms;
  let xchfamount
  let daiAmount
  let randomShareAmount

  const TYPE_DEFAULT = 0;
  const TYPE_ALLOWLISTED = 1;
  const TYPE_FORBIDDEN = 2;
  const TYPE_POWERLISTED = 3;

  before(async () => {
    // get signers and accounts of them
    [owner,sig1,sig2,sig3,sig4,oracle] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address];
    chance = new Chance();

    // random test data with chance
    name = chance.sentence({words: 3});
    symbol = chance.word({length: chance.natural({min: 1, max: 5})}).toUpperCase();
    terms = chance.word({length: chance.natural({min: 1, max: 10})});
    dterms = chance.word({length: chance.natural({min: 1, max: 10})});

    // deploy contracts
    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);
    daiContract = await ethers.getContractAt("ERC20Basic", config.daiAddress);
    wbtcContract = await ethers.getContractAt("ERC20Basic", config.wbtcAddress);

    forceSend = await await ethers.getContractFactory("ForceSend")
      .then(factory => factory.deploy())
      .then(contract => contract.deployed());

    await deployments.fixture(["Shares", "PaymentHub", "Brokerbot", "BrokerbotDAI"]);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotDAI = await ethers.getContract("BrokerbotDAI");

    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await mintERC20(forceSend, baseCurrency, config.baseCurrencyMinterAddress, accounts);
    // Set (manipulate local) DAI balance for first 5 accounts
    await setBalance(daiContract, config.daiBalanceSlot, accounts);
    // Set (manipulate local) WBTC balance for first 5 accounts
    await setBalance(wbtcContract, config.wbtcBalanceSlot, accounts);

    //Mint shares to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await shares.mint(accounts[i], 1000000);
    }

    // Deposit some shares to Brokerbot
    await shares.transfer(brokerbot.address, 500000, { from: accounts[0]});
    await shares.transfer(brokerbotDAI.address, 500000, { from: accounts[0]});
    await baseCurrency.transfer(brokerbot.address, ethers.utils.parseEther("100000"), { from: accounts[0] });
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

    describe("Trading", () => {
      beforeEach(async () => {
        const randomAmount = chance.natural({ min: 500, max: 50000 });
        xchfamount = await brokerbot.getBuyPrice(randomAmount);
      });
      it("Should get price in ETH", async () => {
        const priceusd = await paymentHub.getPriceInUSD(ethers.utils.parseEther("100"));
        // console.log(await ethers.utils.formatEther(priceusd));
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
        await paymentHub.payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: priceInETHWithSlippage});
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);

        // brokerbot should have after the payment with eth the xchf in the balance
        expect(brokerbotBalanceBefore.add(xchfamount)).to.equal(brokerbotBalanceAfter);
      });

      it("Should set setting for keeping ETH", async () => {
        const settingKeepETh = 4;
        const settingsBefore = await brokerbot.settings();

        // new setting with combination of old setting plus keep ETH
        const newSetting = settingsBefore.xor(settingKeepETh);

        await brokerbot.setSettings(newSetting);
        const settingsAfter = await brokerbot.settings();

        expect(settingsAfter).to.not.equal(settingsBefore);
        expect(settingsAfter).to.equal(newSetting);
      });

      it("Should revert if buy with ETH and send to less ETH", async () => {
        const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](xchfamount, brokerbot.address);
        const lowerPriceInETH = priceInETH.mul(90).div(100);
        await expect(paymentHub.payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: lowerPriceInETH})).to.be.reverted;
      });

      it("Should buy shares with ETH and keep ETH", async () => {
        const priceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](xchfamount, brokerbot.address);
        // console.log(await ethers.utils.formatEther(priceInETH));
        // console.log(await priceInETH.toString());

        const brokerbotETHBefore = await ethers.provider.getBalance(brokerbot.address);
        await paymentHub.payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: priceInETH});
        const brokerbotETHAfter = await ethers.provider.getBalance(brokerbot.address);
        // console.log(await ethers.utils.formatEther(brokerbotETHAfter));
        expect(brokerbotETHBefore.add(priceInETH)).to.equal(brokerbotETHAfter);
      });
    });

    describe("Trading with DAI base", () => {
      before(async () => {
        const randomAmountt = chance.natural({ min: 5000, max: 50000 });
        daiAmount = await brokerbotDAI.getBuyPrice(randomAmountt);
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
        await paymentHub.payFromEtherAndNotify(brokerbotDAI.address, daiAmount, "0x01", {value: priceInETHWithSlippage});
        const brokerbotBalanceAfter = await daiContract.balanceOf(brokerbotDAI.address);

        // brokerbot should have after the payment with eth the dai in the balance
        expect(brokerbotBalanceBefore.add(daiAmount)).to.equal(brokerbotBalanceAfter);
      });

      it("Should buy shares and pay with DAI"), async () => {
        //TODO: mint dai and buy shares
      }
    });

    describe("Trading Using WBTC", () => {
      beforeEach(async () => {
        randomShareAmount = chance.natural({ min: 500, max: 50000 });
        xchfamount = await brokerbot.getBuyPrice(randomShareAmount);
      });

      it("Should get price in WBTC", async () => {
        const base = await brokerbot.base();
        const price = await paymentHub.callStatic["getPriceInERC20(uint256,address,address)"](xchfamount, base, config.wbtcAddress);
        expect(price).to.be.above(0);
      });

      it("Should buy shares with WBTC and trade it to XCHF", async () => {
        const base = await brokerbot.base();
        //approve WBTC in the paymenthub
        await paymentHub.approveERC20(config.wbtcAddress);
        
        // get approximate price 
        const priceInWBTC = await paymentHub.callStatic["getPriceInERC20(uint256,address,address)"](xchfamount, base, config.wbtcAddress);

        // little bit more for slippage 
        const priceInWBTCWithSlippage = priceInWBTC.mul(101).div(100);

        // approve wbtc for the user
        await wbtcContract.approve(paymentHub.address, priceInWBTCWithSlippage, { from: accounts[0] });

        //trade and log balance change
        const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
        const sharesBefore = await shares.balanceOf(accounts[0]);
        //console.log("before: %s", await ethers.utils.formatEther(brokerbotBalanceBefore));
        await paymentHub.payFromERC20AndNotify(brokerbot.address, xchfamount, wbtcContract.address, priceInWBTCWithSlippage, "0x01");
        const sharesAfter = await shares.balanceOf(accounts[0]);
        const brokerbotBalanceAfter = await baseCurrency.balanceOf(brokerbot.address);
        //console.log("after: %s", await ethers.utils.formatEther(brokerbotBalanceAfter));

        // brokerbot should have after the payment with eth the xchf in the balance
        expect(brokerbotBalanceBefore.add(xchfamount)).to.equal(brokerbotBalanceAfter);

        // user should get the amount of shares
        expect(sharesBefore.add(randomShareAmount)).to.equal(sharesAfter);
      });

    });
  });
});