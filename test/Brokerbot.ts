
import { expect } from "chai";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import { Contract } from "ethers";
import { Chance } from "chance";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule.ts";
import { setZCHFBalance, setZCHFBalancesForSigners } from "../scripts/helpers/setBalance.ts";
import { checkBrokerbotSetting } from "../scripts/helpers/checkBrokerbotSetting.ts";
import { randomBigInt } from "../scripts/helpers/randomValue.ts";

describe("Brokerbot", function () {  

  let brokerbot: Contract;
  let shares: Contract;
  let draggableShares: Contract
  let paymentHub: Contract
  let zchf: Contract;
  
  before(async function() {
    ({ brokerbot, shares, draggableShares, paymentHub, zchf } = await connection.ignition.deploy(TestModule));

    // Make brokerbot ready to trade
    await shares.connect(owner).mintAndCall(brokerbot, draggableShares, 10000n, "0x");
    await shares.connect(owner).mintAndCall(signer1, draggableShares, 1000n, "0x");
    await setZCHFBalancesForSigners(ethers.parseUnits("10000", 18));
    await draggableShares.connect(signer1).approve(brokerbot, TestModuleConfig.infiniteAllowance)
    await zchf.connect(signer1).approve(paymentHub, TestModuleConfig.infiniteAllowance)
  });

  it("Should deploy", async function () {
    expect(await brokerbot.getAddress()).to.not.be.null
  });

  it("Should get constructor parameters correctly", async function () {
    expect(await brokerbot.token()).to.equal(draggableShares);
    expect(await brokerbot.getPrice()).to.equal(TestModuleConfig.brokerbotConfig.price);
    expect(await brokerbot.increment()).to.equal(TestModuleConfig.brokerbotConfig.increment);
    expect(await brokerbot.base()).to.equal(TestModuleConfig.frankencoinAddress);
    expect(await brokerbot.owner()).to.equal(owner);
    expect(await brokerbot.paymenthub()).to.be.equal(paymentHub);
  });

  it("Should have correct default settings", async function () {
    ({ brokerbot, shares, draggableShares, paymentHub, zchf } = await connection.ignition.deploy(TestModule));
    expect(await brokerbot.VERSION()).to.equal(TestModuleConfig.brokerbotConfig.version);
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.buyingEnabled)).to.be.true;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.sellingEnabled)).to.be.true;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.keepEther)).to.be.false;
  });

  it("should allow enabling/disabling buying/selling.", async function () {
    ({ brokerbot, shares, draggableShares, paymentHub, zchf } = await connection.ignition.deploy(TestModule));
    
    await brokerbot.connect(owner).setEnabled(true, false);      
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.buyingEnabled)).to.be.true;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.sellingEnabled)).to.be.false;
    
    await brokerbot.connect(owner).setEnabled(false, true);
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.buyingEnabled)).to.be.false;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.sellingEnabled)).to.be.true;
    
    await brokerbot.connect(owner).setEnabled(false, false);
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.buyingEnabled)).to.be.false;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.sellingEnabled)).to.be.false;
    
    await brokerbot.connect(owner).setEnabled(true, true);
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.buyingEnabled)).to.be.true;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.sellingEnabled)).to.be.true;
  });

  it("Should be able to change PaymentHub", async function () {
    ({ brokerbot, shares, draggableShares, paymentHub, zchf } = await connection.ignition.deploy(TestModule));

    let owner = await brokerbot.owner()
    let ownerSigner = await ethers.getSigner(owner);
    let dummyAddress = "0x0000000000000000000000000000000000012345"
    await brokerbot.connect(ownerSigner).setPaymentHub(dummyAddress)
    expect(await brokerbot.paymenthub()).to.be.equal(dummyAddress);
  });

  it("Should not be able to change PaymentHub from non-owner", async function () {
    ({ brokerbot, shares, draggableShares, paymentHub, zchf } = await connection.ignition.deploy(TestModule));

    let dummyAddress = "0x0000000000000000000000000000000000012345"
    expect(brokerbot.setPaymentHub(dummyAddress)).to.be.revert(ethers)
  });

  it("Should get correct buy price - no increment", async function () {
    await brokerbot.connect(owner).setPrice(TestModuleConfig.brokerbotConfig.price, 0);

    // Check 0 and 1 share price
    expect(await brokerbot.getBuyPrice(0)).to.eq(0n);
    expect(await brokerbot.getBuyPrice(1)).to.eq(TestModuleConfig.brokerbotConfig.price);
    
    // Do 10 times with random number of shares
    const priceOneShare = await brokerbot.getPrice()
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = randomBigInt(2, 1000);
      const priceRandomNumberShares = await brokerbot.getBuyPrice(randomNumberShares);
      expect(priceOneShare * randomNumberShares).to.eq(priceRandomNumberShares);
    }
  });

  it("Should get correct sell price - no increment", async function () {    
    await brokerbot.connect(owner).setPrice(TestModuleConfig.brokerbotConfig.price, 0);

    // Check 0 and 1 share price
    expect(await brokerbot.getSellPrice(0)).to.eq(0n);
    expect(await brokerbot.getSellPrice(1)).to.eq(TestModuleConfig.brokerbotConfig.price);
    
    // Do 10 times with random number of shares
    const priceOneShare = await brokerbot.getPrice()
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = randomBigInt(2, 1000);
      const priceRandomNumberShares = await brokerbot.getSellPrice(randomNumberShares);
      expect(priceOneShare * randomNumberShares).to.eq(priceRandomNumberShares);
    }
  });    
  
  it("Should allow setting increment", async function () {    
    await brokerbot.connect(owner).setPrice(TestModuleConfig.brokerbotConfig.price, TestModuleConfig.brokerbotConfig.testIncrement);
    expect(await brokerbot.increment()).to.eq(TestModuleConfig.brokerbotConfig.testIncrement);
  });

  it("Should get correct buy price - with increment", async function () {
    await brokerbot.connect(owner).setPrice(TestModuleConfig.brokerbotConfig.price, TestModuleConfig.brokerbotConfig.testIncrement);

    // Check 0 and 1 share price
    expect(await brokerbot.getBuyPrice(0)).to.eq(0n);
    expect(await brokerbot.getBuyPrice(1)).to.eq(TestModuleConfig.brokerbotConfig.price);

    // Do 10 times with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = randomBigInt(2, 1000);
      const priceRandomNumberShares = await brokerbot.getBuyPrice(randomNumberShares);

      // Calculate the most straightforward way
      let calculatedPrice = 0n;
      let priceForShare = TestModuleConfig.brokerbotConfig.price;
      for (let share = 0; share < randomNumberShares; share++) {
        calculatedPrice = calculatedPrice + priceForShare;
        priceForShare = priceForShare + TestModuleConfig.brokerbotConfig.testIncrement;
      }

      expect(calculatedPrice).to.eq(priceRandomNumberShares);
    }
  });  
  
  it("Should get correct sell price - with increment", async function () {
    await brokerbot.connect(owner).setPrice(TestModuleConfig.brokerbotConfig.price, TestModuleConfig.brokerbotConfig.testIncrement);

    // Check 0 and 1 share price
    expect(await brokerbot.getSellPrice(0)).to.eq(0n);
    expect(await brokerbot.getSellPrice(1)).to.eq(TestModuleConfig.brokerbotConfig.price - TestModuleConfig.brokerbotConfig.testIncrement);

    // Do 10 times with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = randomBigInt(2, 100);
      const priceRandomNumberShares = await brokerbot.getSellPrice(randomNumberShares);

      // Calculate the most straightforward way
      let calculatedPrice = 0n;
      let priceForShare = await brokerbot.getSellPrice(1);
      for (let share = 0; share < randomNumberShares; share++) {
        calculatedPrice = calculatedPrice + priceForShare;
        priceForShare = priceForShare - TestModuleConfig.brokerbotConfig.testIncrement;
      }

      expect(calculatedPrice).to.eq(priceRandomNumberShares);
    }
  });

  it("Should get correct shares amount for given price", async function () {
    const price = ethers.parseUnits(new Chance().integer({ min: 1000, max: 10000 }).toString(), "finney" );
    const increment = ethers.parseUnits(new Chance().integer({ min: 1, max: 1000 }).toString(), "finney" );
    await brokerbot.connect(owner).setPrice(price, increment);
      
    // Check 0 and 1 share price
    expect(await brokerbot.getShares(0)).to.equal(0n);
    expect(await brokerbot.getShares(await brokerbot.getBuyPrice(1))).to.equal(1);
  
    // Repeat with random number of shares
    for (let i = 0; i < 10; i++) {
      const randomNumberShares = randomBigInt(2, 100);
      const priceRandomNumberShares = await brokerbot.getBuyPrice(randomNumberShares);
      const calculatedShares = await brokerbot.getShares(priceRandomNumberShares);
      expect(calculatedShares).to.eq(randomNumberShares);
    }
  });


  describe("- Trading", function () {  
    before(async function() {
      // Make brokerbot ready to trade
      ({ brokerbot, shares, draggableShares, paymentHub, zchf } = await connection.ignition.deploy(TestModule));

      await shares.connect(owner).mintAndCall(await brokerbot.getAddress(), await draggableShares.getAddress(), 10000n, "0x");
      await shares.connect(owner).mintAndCall(signer1, await draggableShares.getAddress(), 1000n, "0x");
      await setZCHFBalance(signer1.address, ethers.parseUnits("1000", "ether"))
      await zchf.connect(signer1).approve(await paymentHub.getAddress(), TestModuleConfig.infiniteAllowance)
      await brokerbot.connect(owner).setPrice(TestModuleConfig.brokerbotConfig.price, 0);
    });

    it('Should sell shares against BaseCurrency', async function () {  
      const buyPrice = await brokerbot.getBuyPrice(TestModuleConfig.brokerbotConfig.testAmount);
      const shareBalanceBefore = await draggableShares.balanceOf(signer1.address);
      const baseCurrencyBalanceBefore = await zchf.balanceOf(signer1.address);
  
      expect(await paymentHub.connect(signer1).payAndNotify(await brokerbot.getAddress(), buyPrice, "0x"))
        .to.emit(brokerbot, "Trade")
        .withArgs(await draggableShares.getAddress(), signer1, "0x", TestModuleConfig.brokerbotConfig.testAmount, await zchf.getAddress(), buyPrice, 0, TestModuleConfig.brokerbotConfig.price);
  
      const shareBalanceAfter = await draggableShares.balanceOf(signer1);
      const baseCurrencyBalanceAfter = await zchf.balanceOf(signer1);
  
      expect(shareBalanceBefore + TestModuleConfig.brokerbotConfig.testAmount).to.be.equal(shareBalanceAfter);
      expect(baseCurrencyBalanceBefore - buyPrice).to.be.equal(baseCurrencyBalanceAfter);
    })
  })
});