const {network, ethers, deployments, } = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");

// Shared  Config
const config = require("../migrations/migration_config");

describe("New PaymentHub", () => {
  let draggable
  let shares
  let recoveryHub;
  let baseCurrency;
  let paymentHub;
  let forceSend;
  let offerFactory
  let allowlistShares;
  let allowlistDraggable;

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

    await deployments.fixture(['PaymentHub']);
    paymentHub = await ethers.getContract('PaymentHub');

  });

  describe("Deployment", () => {
    describe("PaymentHub", () => {
      it("Should deploy contract", async () => {
        expect(paymentHub.address).to.exist;
      });
  
      it("Should have params specified at the constructor", async() => {
        expect(await paymentHub.currency()).to.equal("0xB4272071eCAdd69d933AdcD19cA99fe80664fc08");
      }); 

      it("Should get price in ETH", async () => {
        const price = await paymentHub.getLatestPriceETHUSD();
        console.log(await price.toString());
        const pricechf = await paymentHub.getLatestPriceCHFUSD();
        console.log(await pricechf.toString());
        let priceInETH = await paymentHub.getPriceInEther(1000);
        priceInETH = ethers.utils.formatEther(priceInETH);
        console.log(await priceInETH.toString());
      });
    });
  });
});