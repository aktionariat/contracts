const {network, ethers, getNamedAccounts, deployments} = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
// Shared  Config
const config = require("../scripts/deploy_config.js");

use(solidity);

describe("Brokerbot Registry", () => {
  let brokerbotRegistry;
  let draggable;
  let shares;
  let recoveryHub;
  let brokerbot;
  let paymentHub;
  let offerFactory

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;

  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];

    await deployments.fixture([
      "BrokerbotRegistry",
      "RecoveryHub",
      "OfferFactory",
      "Shares",
      "DraggableShares",
      "Brokerbot"
    ]);

    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotRegistry = await ethers.getContract("BrokerbotRegistry")

  });
  
  it("Should register brokerbot", async () => {
    await expect(brokerbotRegistry.registerBrokerbot(brokerbot.address, config.baseCurrencyAddress, draggable.address))
      .to.be.revertedWith("not owner")
    await expect(brokerbotRegistry.connect(owner).registerBrokerbot(brokerbot.address, config.baseCurrencyAddress, draggable.address))
      .to.emit(brokerbotRegistry, "RegisterBrokerbot")
      .withArgs(brokerbot.address, config.baseCurrencyAddress, draggable.address);
    const registry = await brokerbotRegistry.getBrokerbots(config.baseCurrencyAddress, draggable.address);
    expect(registry).to.be.equal(brokerbot.address);
  });

  it("Should emit event on sync", async () => {
    await expect(brokerbotRegistry.syncBrokerbot(brokerbot.address))
      .to.emit(brokerbotRegistry, "SyncBrokerbot")
      .withArgs(brokerbot.address);
  });

});