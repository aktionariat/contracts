const {network, ethers, } = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");

// Shared  Config
const config = require("../migrations/migration_config");

describe.only("New Standard", () => {
  let draggable
  let shares
  let recoveryHub;
  let baseCurrency;
  let paymentHub;
  let forceSend;

  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let accounts;
  let signers;

  let chance;
  let name;
  let symbol;
  let terms;
  let dterms;

  before(async () => {
    // get signers and accounts of them
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    signers = [owner,adr1,adr2,adr3,adr4] ;
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];
    chance = new Chance();

    // random test data with chance
    name = chance.sentence({words: 3});
    symbol = chance.word({length: chance.natural({min: 1, max: 5})}).toUpperCase();
    terms = chance.word({length: chance.natural({min: 1, max: 10})});
    dterms = chance.word({length: chance.natural({min: 1, max: 10})});

    // deploy contracts
    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);

    paymentHub = await await ethers.getContractFactory("PaymentHub")
      .then(factory => factory.deploy(config.baseCurrencyAddress))
      .then(contract => contract.deployed());

    forceSend = await await ethers.getContractFactory("ForceSend")
      .then(factory => factory.deploy())
      .then(contract => contract.deployed());

    recoveryHub = await ethers.getContractFactory("RecoveryHub")
      .then(factory => factory.deploy())
      .then(recoveryHub => recoveryHub.deployed());

    shares = await ethers.getContractFactory("Shares")
     .then(sharesFactory => sharesFactory.deploy(symbol, name, terms, config.totalShares, owner.address, recoveryHub.address))
     .then(shares => shares.deployed());

    draggable = await ethers.getContractFactory("DraggableShares")
      .then(draggableFactory => draggableFactory.deploy(dterms, shares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address))
      .then(draggable => draggable.deployed());

    
    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [config.baseCurrencyMinterAddress],
    });
    const signer = await ethers.provider.getSigner(config.baseCurrencyMinterAddress);
    await forceSend.send(config.baseCurrencyMinterAddress, {value: ethers.BigNumber.from("1000000000000000000")});
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
      await shares.mint(accounts[i], 100000);
    }

     // Convert some Shares to DraggableShares
    for (let i = 0; i < 5; i++) {
      await shares.connect(signers[i]).approve(draggable.address, config.infiniteAllowance);
      await draggable.connect(signers[i]).wrap(accounts[i], 80000);
    }

  });

  describe("Deployment", () => {
    describe("Shares", () => {
      it("Should deploy shares", async () => {
        expect(shares.address).to.exist;
      });

      it("Should have params specified at the constructor", async() => {
        expect(await shares.name()).to.equal(name);
        expect(await shares.symbol()).to.equal(symbol);
        expect(await shares.terms()).to.equal(terms);
      }); 
    });

    describe("Draggable Shares", () => {
      it("Should deploy contracts", async () => {
        expect(draggable.address).to.exist;
      });
  
      it("Should have params specified at the constructor", async() => {
        expect(await draggable.terms()).to.equal(dterms);
      }); 

    })
  });

  describe("Setup", () => {
    it("should have some ETH in first 5 accounts", async () => {  
      for (let i = 0; i < 5; i++) {
        const balance = ethers.BigNumber.from(await ethers.provider.getBalance(accounts[i]));
        assert(!balance.isZero(), "Balance is 0");
      }
    });
  
    it("should have some BaseCurrency in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await baseCurrency.balanceOf(accounts[i]);
        assert(!balance.isZero(), "Balance is 0");
      }
    });

    it("should have some Shares in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await shares.balanceOf(accounts[i]);
        assert(!balance.isZero(), "Balance is 0");
      }
    });

    it("should have some DraggableShares in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await draggable.balanceOf(accounts[i]);
        assert(!balance.isZero());
      }
    });
  
  });

  describe.only("Reovery", () => {
    it("Should able to disable recovery", async () => {
      const recovery = await ethers.getContractAt("RecoveryHub", await draggable.recovery());
      await recovery.connect(adr1).setRecoverable(false);
      expect(await recoveryHub.isRecoveryEnabled(adr1.address)).to.equal(false);
    });

    it("Should revert declare lost on disabled recovery", async () => {
      await expect(recoveryHub.connect(adr2).declareLost(draggable.address, draggable.address, adr1.address))
        .to.be.revertedWith("disabled");
    });
    it("Should able to recover token", async () => {
      await draggable.connect(adr2).approve(recoveryHub.address, config.infiniteAllowance);
      const amountLost = await draggable.balanceOf(adr3.address);
      const amountClaimer = await draggable.balanceOf(adr2.address);
      await recoveryHub.connect(adr2).declareLost(draggable.address, draggable.address, adr3.address);
      // revert if not the claimer tries to recover
      await expect(recoveryHub.connect(adr4).recover(draggable.address, adr3.address)).to.be.revertedWith("not claimant");
      // revert if to early
      await expect(recoveryHub.connect(adr2).recover(draggable.address, adr3.address)).to.be.revertedWith("too early");
      // add claim period (180 days)
      const claimPeriod = await draggable.claimPeriod().then(p => p.toNumber());
      await ethers.provider.send("evm_increaseTime", [claimPeriod]);
      await ethers.provider.send("evm_mine");
      // recover tokens
      await recoveryHub.connect(adr2).recover(draggable.address, adr3.address);
      expect(await draggable.balanceOf(adr2.address)).to.equal(await amountLost.add(amountClaimer));
    });

  });
});