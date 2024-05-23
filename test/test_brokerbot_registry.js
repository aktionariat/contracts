const {network, ethers, getNamedAccounts, deployments} = require("hardhat");
const { expect } = require("chai");
// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);


describe("Brokerbot Registry", () => {
  let brokerbotRegistry;
  let draggable;
  let shares;
  let recoveryHub;
  let brokerbot;
  let paymentHub;
  let offerFactory;
  let tokenRegistry;

  let brokerbotRegistryAdr;
  let tokenRegistryAdr;
  let draggableAdr;
  let brokerbotAdr;

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
      "Brokerbot",
      "TokenRegistry"
    ]);

    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotRegistry = await ethers.getContract("BrokerbotRegistry")
    tokenRegistry = await ethers.getContract("TokenRegistry");

    brokerbotRegistryAdr = await brokerbotRegistry.getAddress();
    brokerbotAdr = await brokerbot.getAddress();
    tokenRegistryAdr = await tokenRegistry.getAddress();
    draggableAdr = await draggable.getAddress();

  });
  
  it("Should register brokerbot", async () => {
    await expect(brokerbotRegistry.connect(sig1).registerBrokerbot(brokerbotAdr, tokenRegistryAdr))
      .to.be.revertedWithCustomError(brokerbotRegistry, "Ownable_NotOwner")
      .withArgs(sig1.address);
    await expect(brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotAdr, tokenRegistryAdr))
      .to.emit(brokerbotRegistry, "RegisterBrokerbot")
      .withArgs(brokerbotAdr, config.baseCurrencyAddress, draggableAdr);
    const registry = await brokerbotRegistry.getBrokerbot(config.baseCurrencyAddress, draggableAdr);
    expect(registry).to.be.equal(brokerbotAdr);
  });

  it("Should emit event on sync", async () => {
    await expect(brokerbotRegistry.syncBrokerbot(brokerbotAdr))
      .to.emit(brokerbotRegistry, "SyncBrokerbot")
      .withArgs(brokerbotAdr);
  });

});
