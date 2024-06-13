const {network, ethers, getNamedAccounts, deployments} = require("hardhat");
const { expect } = require("chai");
// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);


describe("Registry", () => {
  let brokerbotRegistry;
  let draggable;
  let shares;
  let recoveryHub;
  let brokerbot;
  let brokerbotDAI;
  let brokerbotZCHF;
  let paymentHub;
  let offerFactory;
  let tokenRegistry;

  let brokerbotRegistryAdr;
  let tokenRegistryAdr;
  let draggableAdr;
  let sharesAdr;
  let brokerbotAdr;
  let brokerbotZCHFAdr;
  let brokerbotDAIAdr

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;

  beforeEach(async () => {
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
      "BrokerbotZCHF",
      "BrokerbotDAI",
      "TokenRegistry"
    ]);

    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotZCHF = await ethers.getContract("BrokerbotZCHF");
    brokerbotDAI = await ethers.getContract("BrokerbotDAI");
    brokerbotRegistry = await ethers.getContract("BrokerbotRegistry")
    tokenRegistry = await ethers.getContract("TokenRegistry");

    brokerbotRegistryAdr = await brokerbotRegistry.getAddress();
    brokerbotAdr = await brokerbot.getAddress();
    brokerbotZCHFAdr = await brokerbotZCHF.getAddress();
    brokerbotDAIAdr = await brokerbotDAI.getAddress();
    tokenRegistryAdr = await tokenRegistry.getAddress();
    draggableAdr = await draggable.getAddress();
    sharesAdr = await shares.getAddress();

  });

  describe("Brokerbot Registry", () => {
    it("Should register brokerbot", async () => {
      await expect(brokerbotRegistry.connect(sig1).registerBrokerbot(brokerbotAdr, tokenRegistryAdr))
        .to.be.revertedWithCustomError(brokerbotRegistry, "Ownable_NotOwner")
        .withArgs(sig1.address);
      await expect(brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotAdr, tokenRegistryAdr))
        .to.emit(brokerbotRegistry, "BrokerbotRegistered")
        .withArgs(brokerbotAdr, config.baseCurrencyAddress, draggableAdr)
        .to.emit(tokenRegistry, "ShareTokenAdded")
        .withArgs(draggableAdr);
      const registeredBrokerbot = await brokerbotRegistry.getBrokerbot(config.baseCurrencyAddress, draggableAdr);
      expect(registeredBrokerbot).to.be.equal(brokerbotAdr);
      expect(await brokerbotRegistry.getBrokerbot(config.baseCurrencyAddress, draggableAdr)).to.be.equal(brokerbotAdr);
      expect(await tokenRegistry.cointainsShareToken(draggableAdr)).to.be.true;
      expect(await tokenRegistry.amountOfShareToken()).to.be.equal(1n);
    });

    it("Should register new active brokerbot", async() =>{
      await brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotDAIAdr, tokenRegistryAdr);
      await expect(brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotZCHFAdr, tokenRegistryAdr))
        .to.emit(brokerbotRegistry, "BrokerbotRegistered")
        .withArgs(brokerbotZCHFAdr, config.zchfAddress, sharesAdr);
      await expect(brokerbotRegistry.connect(sig2).deactivateBrokerbot(brokerbotDAIAdr))
        .to.be.revertedWithCustomError(brokerbotRegistry, "Ownable_NotOwner");
      const tx = await brokerbotRegistry.connect(owner).deactivateBrokerbot(brokerbotDAIAdr);
      expect(tx).to.emit(brokerbotRegistry, "BrokerbotDeactivated").withArgs(brokerbotDAIAdr);
      const activeBrokerbots = await brokerbotRegistry.getAllActiveBrokerbots();
      expect(activeBrokerbots.length).to.be.equal(1);
      const allBrokerbots = await brokerbotRegistry.getAllBrokerbots();
      expect(allBrokerbots.length).to.be.equal(2);
    })
  
    it("Should emit event on sync", async () => {
      await expect(brokerbotRegistry.syncBrokerbot(brokerbotAdr))
        .to.emit(brokerbotRegistry, "BrokerbotSync")
        .withArgs(brokerbotAdr);
    });

    it("Should get active brokerbot", async() => {
      await brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotAdr, tokenRegistryAdr);
      expect(await brokerbotRegistry.getBrokerbot(config.baseCurrencyAddress, draggableAdr)).to.be.equal(brokerbotAdr);
      const activeBrokerbots = await brokerbotRegistry.getAllActiveBrokerbots();
      expect(activeBrokerbots.length).to.be.equal(1);
      expect(activeBrokerbots[0]).to.be.equal(brokerbotAdr);
    })

    it("Should get all brokerbots", async() => {
      await brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotAdr, tokenRegistryAdr);
      const brokerbots = await brokerbotRegistry.getAllBrokerbots();
      expect(brokerbots.length).to.be.equal(1);
      expect(brokerbots[0]).to.be.equal(brokerbotAdr);
    })

    it("Should not add same brokerbot twice in set", async() => {
      await brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotAdr, tokenRegistryAdr);
      await brokerbotRegistry.connect(owner).registerBrokerbot(brokerbotAdr, tokenRegistryAdr);
      const brokerbots = await brokerbotRegistry.getAllBrokerbots();
      const activeBrokerbots = await brokerbotRegistry.getAllActiveBrokerbots();
      expect(activeBrokerbots.length).to.be.equal(1);
      expect(brokerbots.length).to.be.equal(1);
    })

  });

  describe("Token Registry", () => {
    it("Should register token as owner", async() => {
      // revert if not owner
      await expect(tokenRegistry.connect(sig1).addShareToken(draggableAdr))
        .to.be.revertedWithCustomError(tokenRegistry, "TokenRegistry__Unauthorized");
      // emit event when successful
      await expect(tokenRegistry.connect(owner).addShareToken(draggableAdr))
        .to.emit(tokenRegistry, "ShareTokenAdded")
        .withArgs(draggableAdr);
    });

    it("Should remove token only as owner", async() => {
      await tokenRegistry.connect(owner).addShareToken(draggableAdr);
      // revert if not owner
      await expect(tokenRegistry.connect(sig1).removeShareToken(draggableAdr))
        .revertedWithCustomError(tokenRegistry, "Ownable_NotOwner");
      // emit event when successful
      await expect(tokenRegistry.connect(owner).removeShareToken(draggableAdr))
        .to.emit(tokenRegistry, "ShareTokenRemoved")
        .withArgs(draggableAdr);
      expect(await tokenRegistry.cointainsShareToken(draggableAdr)).to.be.false;
    });

    it("Should give back amount of token", async() => {
      await tokenRegistry.connect(owner).addShareToken(draggableAdr);
      expect(await tokenRegistry.amountOfShareToken()).to.be.equal(1);
    });

    it("Should give back all token addresses", async() => {
      await tokenRegistry.connect(owner).addShareToken(draggableAdr);
      const tokens = await tokenRegistry.getAllShareToken();
      expect(tokens.length).to.be.equal(1);
      expect(tokens[0]).to.be.equal(draggableAdr);
    })

    it("Should check if token is already registered", async() => {
      await tokenRegistry.connect(owner).addShareToken(draggableAdr);
      expect(await tokenRegistry.cointainsShareToken(draggableAdr)).to.be.true;
    })

    it("Should change brokerbotregistry only by owner", async() => {
      await expect(tokenRegistry.setBrokerbotRegistry(ethers.ZeroAddress))
        .revertedWithCustomError(tokenRegistry, "Ownable_NotOwner");
      await expect(tokenRegistry.connect(owner).setBrokerbotRegistry(ethers.ZeroAddress))
        .to.emit(tokenRegistry, "BrokerbotRegistryUpdated")
        .withArgs(ethers.ZeroAddress);
      expect(await tokenRegistry.brokerbotRegistry()).to.be.equal(ethers.ZeroAddress);
    })
  });
});
