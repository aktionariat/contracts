import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { checkBrokerbotSetting } from "../scripts/helpers/checkBrokerbotSetting";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("Brokerbot", function () {  
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  
  before(async function() {
    [deployer, owner] = await ethers.getSigners();
  });

  it("Should deploy", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    expect(await brokerbot.getAddress()).to.not.be.null
  });

  it("Should get constructor parameters correctly", async function () {
    const { brokerbot, draggableShares, paymentHub } = await loadFixture(deployTestModuleFixture);
    expect(await brokerbot.token()).to.equal(draggableShares);
    expect(await brokerbot.getPrice()).to.equal(TestModuleConfig.brokerbotConfig.price);
    expect(await brokerbot.increment()).to.equal(TestModuleConfig.brokerbotConfig.increment);
    expect(await brokerbot.base()).to.equal(TestModuleConfig.frankencoinAddress);
    expect(await brokerbot.owner()).to.equal(owner);
    expect(await brokerbot.paymenthub()).to.be.equal(paymentHub);
  });

  it("Should have correct default settings", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    expect(await brokerbot.VERSION()).to.equal(TestModuleConfig.brokerbotConfig.version);
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.buyingEnabled)).to.be.true;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.sellingEnabled)).to.be.true;
    expect(await checkBrokerbotSetting(brokerbot, TestModuleConfig.brokerbotConfig.keepEther)).to.be.false;
  });


  it("should allow enabling/disabling buying/selling.", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    
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
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    let owner = await brokerbot.owner()
    let ownerSigner = await ethers.getSigner(owner);
    let dummyAddress = "0x0000000000000000000000000000000000012345"
    await brokerbot.connect(ownerSigner).setPaymentHub(dummyAddress)
    expect(await brokerbot.paymenthub()).to.be.equal(dummyAddress);
  });

  it("Should not be able to change PaymentHub from non-owner", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    let dummyAddress = "0x0000000000000000000000000000000000012345"
    expect(brokerbot.setPaymentHub(dummyAddress)).to.be.reverted
  });
});