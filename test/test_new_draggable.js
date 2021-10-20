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
  let offerMaster;
  let offerFactory

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

  before(async () => {
    // get signers and accounts of them
    [owner,sig1,sig2,sig3,sig4,oracle] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4] ;
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

    paymentHub = await await ethers.getContractFactory("PaymentHub")
      .then(factory => factory.deploy(config.baseCurrencyAddress))
      .then(contract => contract.deployed());

    recoveryHub = await ethers.getContractFactory("RecoveryHub")
      .then(factory => factory.deploy())
      .then(recoveryHub => recoveryHub.deployed());
      
    offerMaster = await ethers.getContractFactory("Offer")
      .then(factory => factory.deploy())
      .then(contract => contract.deployed());

    offerFactory = await ethers.getContractFactory("OfferFactory")
      .then(factory => factory.deploy(offerMaster.address))
      .then(contract => contract.deployed());    

    shares = await ethers.getContractFactory("Shares")
     .then(sharesFactory => sharesFactory.deploy(symbol, name, terms, config.totalShares, owner.address, recoveryHub.address))
     .then(shares => shares.deployed());

    draggable = await ethers.getContractFactory("DraggableShares")
      .then(draggableFactory => draggableFactory.deploy(dterms, shares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, oracle.address))
      .then(draggable => draggable.deployed());

    
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

     // Convert some Shares to DraggableShares
    for (let i = 0; i < 5; i++) {
      await shares.connect(signers[i]).approve(draggable.address, config.infiniteAllowance);
      await draggable.connect(signers[i]).wrap(accounts[i], 1000000);
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

  describe("Recovery", () => {
    it("Should able to disable recovery", async () => {
      const recovery = await ethers.getContractAt("RecoveryHub", await draggable.recovery());
      await recovery.connect(sig1).setRecoverable(false);
      expect(await recoveryHub.isRecoveryEnabled(sig1.address)).to.equal(false);
    });

    it("Should revert declare lost on disabled recovery", async () => {
      await expect(recoveryHub.connect(sig2).declareLost(draggable.address, draggable.address, sig1.address))
        .to.be.revertedWith("disabled");
    });
    it("Should able to recover token", async () => {
      await draggable.connect(sig2).approve(recoveryHub.address, config.infiniteAllowance);
      const amountLost = await draggable.balanceOf(sig3.address);
      const amountClaimer = await draggable.balanceOf(sig2.address);
      await recoveryHub.connect(sig2).declareLost(draggable.address, draggable.address, sig3.address);

      // check if flag is set
      // FLAG_CLAIM_PRESENT = 10
      expect(await draggable.hasFlag(sig3.address, 10)).to.equal(true);

      // revert if not the claimer tries to recover
      await expect(recoveryHub.connect(sig4).recover(draggable.address, sig3.address)).to.be.revertedWith("not claimant");

      // revert if to early
      await expect(recoveryHub.connect(sig2).recover(draggable.address, sig3.address)).to.be.revertedWith("too early");

      // add claim period (180 days)
      const claimPeriod = await draggable.claimPeriod().then(p => p.toNumber());
      await ethers.provider.send("evm_increaseTime", [claimPeriod]);
      await ethers.provider.send("evm_mine");

      // recover tokens
      await recoveryHub.connect(sig2).recover(draggable.address, sig3.address);
      expect(await draggable.balanceOf(sig2.address)).to.equal(await amountLost.add(amountClaimer));
    });
  });

  describe.only("Offer", () => {
    beforeEach(async () => {
      const overrides = {
        value: ethers.utils.parseEther("5.0")
      }
      await draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('1'), ethers.utils.parseEther("2"), baseCurrency.address, overrides)
      const blockNum = await ethers.provider.getBlockNumber();
      const block= await ethers.provider.getBlock(blockNum);
    });
    it("Should able to make aquisition offer", async () => {
      const offer = await draggable.offer();
      expect(offer).to.exist;
      expect(offer).to.not.equal("0x0000000000000000000000000000000000000000");
    });
    
    it("Shareholder can vote", async () => {
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      await offer.connect(sig1).voteYes();
      // FLAG_VOTED = 1
      expect(await draggable.hasFlag(sig1.address, 1)).to.equal(true);
    });

    it("Should able to contest offer after expiry", async () => {
      const threedays = 3*24*60*60;
      const expiry = await draggable.votePeriod().then(period => period.add(threedays));
      await ethers.provider.send("evm_increaseTime", [expiry.toNumber()]);
      await ethers.provider.send("evm_mine");
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      await offer.contest();
      const offerAfterContest = await draggable.offer();
      expect(offerAfterContest).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should able to contest offer if declined", async () => {
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      await offer.connect(owner).voteNo();
      await offer.connect(sig2).voteNo();
      await offer.connect(sig3).voteNo();
      await offer.contest();
      const offerAfterContest = await draggable.offer();
      expect(offerAfterContest).to.equal("0x0000000000000000000000000000000000000000");
    });
    
    it("Should be able to make better offer", async () => {
      // offer from sig1
      const offerBefore = await draggable.offer();
      expect(offerBefore).to.exist;
      
      const overrides = {
        value: ethers.utils.parseEther("5.0")
      }
      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('4'), ethers.utils.parseEther("1"), baseCurrency.address, overrides))
        .to.revertedWith("old offer better");
      await draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('4'), ethers.utils.parseEther("3"), baseCurrency.address, overrides);
      
      // new offer from sig1
      const offerAfter = await draggable.offer();
      expect(offerAfter).to.exist;
      expect(offerAfter).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(offerAfter).to.not.equal(offerBefore);
      
    });
    

    it.only("Should be able to excute offer", async () => {
      //create offr
      //vote
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      await offer.connect(owner).voteYes();
      await offer.connect(sig1).voteYes();
      await offer.connect(sig2).voteYes();
      await offer.connect(sig3).voteYes();
      await offer.connect(sig4).voteYes();

      // external vote
      // check "external tokens"
      let internalTokens = ethers.BigNumber.from(0);
      for( let i = 0; i < 5; i++) {
        internalTokens = internalTokens.add(await draggable.balanceOf(accounts[i]));
      }
      const totalVotingTokens = await draggable.totalVotingTokens();
      const externalTokens = totalVotingTokens.sub(internalTokens);
      console.log(totalVotingTokens.toString());
      console.log(internalTokens.toString());
      console.log(externalTokens.toString());
      console.log(await baseCurrency.balanceOf(sig1.address).then(bn => bn.toString()));
      await offer.connect(oracle).reportExternalVotes(externalTokens, 0);

      //execute
      await baseCurrency.connect(sig1).approve(offer.address, config.infiniteAllowance);
      await offer.execute();
      console.log(await shares.balanceOf(sig1.address).then(bal => bal.toString()));
      expect(await shares.balanceOf(sig1.address)).to.equal(await shares.totalSupply());
    });

    afterEach(async () => {
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      if(offer.address !== "") { 
        await offer.connect(sig1).cancel();
      }
    })
  });
});