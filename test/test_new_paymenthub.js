const {network, ethers, deployments, } = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");

// Shared  Config
const config = require("../migrations/migration_config");
const { brokerbotOwnerAddress } = require("../migrations/migration_config");

describe("New PaymentHub", () => {
  let draggable;
  let shares;
  let recoveryHub;
  let baseCurrency;
  let paymentHub;
  let forceSend;
  let offerFactory;
  let allowlistShares;
  let allowlistDraggable;
  let brokerbot;
  let multisig;

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
    forceSend = await await ethers.getContractFactory("ForceSend")
      .then(factory => factory.deploy())
      .then(contract => contract.deployed());

    await deployments.fixture(["Shares", "PaymentHub", "Brokerbot"]);
    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    brokerbot = await ethers.getContract("Brokerbot");

    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [config.baseCurrencyMinterAddress],
    });
    const signer = await ethers.provider.getSigner(config.baseCurrencyMinterAddress);
    await forceSend.send(config.baseCurrencyMinterAddress, {value: ethers.utils.parseEther("2")});
    for (let i = 0; i < 5; i++) {
      await baseCurrency.connect(signer).mint(accounts[i], ethers.utils.parseEther("10000000"));
      //console.log("account %s chf %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
    }
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [config.baseCurrencyMinterAddress],
    });

    //Mint shares to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await shares.mint(accounts[i], 1000000);
    }

    // Deposit some shares to Brokerbot
    await shares.transfer(brokerbot.address, 500000, { from: accounts[0]});
    await baseCurrency.transfer(brokerbot.address, web3.utils.toWei("100000"), { from: accounts[0] });
  });

  describe("Deployment", () => {
    describe("PaymentHub", () => {
      it("Should deploy contract", async () => {
        expect(paymentHub.address).to.exist;
      });
  
      it("Should have params specified at the constructor", async() => {
        expect(await paymentHub.currency()).to.equal("0xB4272071eCAdd69d933AdcD19cA99fe80664fc08");
      }); 
    });

    describe("BrokerBot", () => {
      it("Should deploy contract", async () => {
        expect(brokerbot.address).to.exist;
      });
    });

    describe("Trading", () => {
      beforeEach(async () => {
        const randomAmount = chance.natural({ min: 50000, max: 50000 });
        xchfamount = await brokerbot.getBuyPrice(randomAmount);
      });
      it("Should get price in ETH", async () => {
        const priceusd = await paymentHub.getPriceInUSD(ethers.utils.parseEther("100"));
        // console.log(await ethers.utils.formatEther(priceusd));
        const priceeth = await paymentHub.getLatestPriceETHUSD();
        // console.log(await priceeth.toString());
        
        const priceInETH = await paymentHub.getPriceInEther(ethers.utils.parseEther("1000"));
        // rework to not use static value
        expect(await ethers.utils.formatEther(priceInETH)).to.equal("0.244787563584463807")
      });

      it("Should buy shares with ETH and trade it to XCHF", async () => {
        let priceInETH = await paymentHub.getPriceInEther(xchfamount);

        // send a little bit more as price from oracle isn't 1:1 uniswap price
        priceInETH = priceInETH.mul(11).div(10);

        const brokerbotBalanceBefore = await baseCurrency.balanceOf(brokerbot.address);
        await paymentHub.payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: priceInETH});
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

        expect(settingsBefore).to.not.equal(settingsAfter);
        expect(settingsAfter).to.equal(newSetting);
      });


      it("Should buy shares with ETH and keep ETH", async () => {
        let priceInETH = await paymentHub.getPriceInEther(xchfamount);
        // console.log(await ethers.utils.formatEther(priceInETH));

        let brokerbotETHBefore = await ethers.provider.getBalance(brokerbot.address);
        await paymentHub.payFromEtherAndNotify(brokerbot.address, xchfamount, "0x01", {value: priceInETH});
        let brokerbotETHAfter = await ethers.provider.getBalance(brokerbot.address);
        // console.log(await ethers.utils.formatEther(brokerbotETHAfter));
        expect(brokerbotETHBefore.add(priceInETH)).to.equal(brokerbotETHAfter);
      });
    });
  });
});