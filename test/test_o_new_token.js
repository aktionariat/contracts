const {network, ethers, } = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");

// Shared  Config
const config = {
  // Parameters used during contract development and testing
  symbol: "TEST",
  name: "Test Shares",
  terms: "test.ch/terms",
  totalShares: 10000000,
  sharePrice: "1000000000000000000",
  baseCurrencyAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  baseCurrencyMinterAddress: "0xad32aA4Bff8b61B4aE07E3BA437CF81100AF0cD7",
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  quorumBps: 7500,
  votePeriodSeconds: 5184000,
  uniswapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
};

describe("New Standard", () => {
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
    
    forceSend = await await ethers.getContractFactory("ForceSend")
    .then(factory => factory.deploy())
    .then(contract => contract.deployed());
    
    paymentHub = await await ethers.getContractFactory("PaymentHub")
    .then(factory => factory.deploy(config.baseCurrencyAddress))
    .then(contract => contract.deployed());
    
    recoveryHub = await ethers.getContractFactory("RecoveryHub")
    .then(factory => factory.deploy())
    .then(contract => contract.deployed());
    
    offerFactory = await ethers.getContractFactory("OfferFactory")
    .then(factory => factory.deploy())
    .then(contract => contract.deployed());    
    
    shares = await ethers.getContractFactory("Shares")
     .then(factory => factory.deploy(symbol, name, terms, config.totalShares, owner.address, recoveryHub.address))
     .then(contract => contract.deployed());

    draggable = await ethers.getContractFactory("DraggableShares")
      .then(factory => factory.deploy(dterms, shares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, oracle.address))
      .then(contract => contract.deployed());

    allowlistShares = await ethers.getContractFactory("AllowlistShares")
      .then(factory => factory.deploy(symbol, name, terms, config.totalShares, recoveryHub.address, owner.address))
      .then(contract => contract.deployed());
    // use for gas usage calc
    // const { gasUsed: createGasUsed } = await allowlistShares.deployTransaction.wait();
    // console.log("Deployment gas usage: %s", await createGasUsed.toString());

    allowlistDraggable = await ethers.getContractFactory("AllowlistDraggableShares")
      .then(factory => factory.deploy(dterms, allowlistShares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, oracle.address, owner.address))
      .then(contract => contract.deployed());

    
    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [config.baseCurrencyMinterAddress],
    });
    const signer = await ethers.provider.getSigner(config.baseCurrencyMinterAddress);
    await forceSend.send(config.baseCurrencyMinterAddress, {value: ethers.utils.parseEther("2")});
    const bal = await baseCurrency.balanceOf(config.baseCurrencyMinterAddress);
    console.log(await bal.toString());
    for (let i = 0; i < 5; i++) {
      await baseCurrency.connect(signer).transfer(accounts[i], ethers.utils.parseEther("1000000"));
     console.log("account %s dai %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
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
      await draggable.connect(signers[i]).wrap(accounts[i], 900000);
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
    });

    describe("AllowlistShares", () => {
      it("Should deploy allowlist shares", async () => {
        expect(allowlistShares.address).to.exist;
      });

      it("Should have params specified at the constructor", async() => {
        expect(await allowlistShares.name()).to.equal(name);
        expect(await allowlistShares.symbol()).to.equal(symbol);
        expect(await allowlistShares.terms()).to.equal(terms);
      }); 
    });

    describe("Allowlist Draggable Shares", () => {
      it("Should deploy contracts", async () => {
        expect(allowlistDraggable.address).to.exist;
      });
  
      it("Should have params specified at the constructor", async() => {
        expect(await allowlistDraggable.terms()).to.equal(dterms);
      }); 
    });
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

  describe("Offer", () => {
    beforeEach(async () => {
      const overrides = {
        value: ethers.utils.parseEther("5.0")
      }
      await draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('1'), ethers.utils.parseEther("0.12"), baseCurrency.address, overrides)
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
      const threedays = 30*24*60*60;
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
        value: ethers.utils.parseEther("3")
      }
      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('4'), ethers.utils.parseEther("0.1"), baseCurrency.address, overrides))
        .to.revertedWith("old offer better");
      await draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('4'), ethers.utils.parseEther("0.13"), baseCurrency.address, overrides);
      
      // new offer from sig1
      const offerAfter = await draggable.offer();
      expect(offerAfter).to.exist;
      expect(offerAfter).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(offerAfter).to.not.equal(offerBefore);
      
    });
    

    it("Should be able to execute offer", async () => {
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      // buyer share balance before voting/excute
      const buyerBal = await shares.balanceOf(sig1.address);

      // vote and get total of draggable sahres
      let draggableTotal = 0
      for(let i = 0; i<signers.length; i++){
        await offer.connect(signers[i]).voteYes();
        draggableTotal = await draggable.balanceOf(accounts[i]).then(bal => bal.add(draggableTotal));
      }

      // collect external vote
      const externalTokens = ethers.BigNumber.from(3000000);
      await offer.connect(oracle).reportExternalVotes(externalTokens, 0);

      //execute
      await baseCurrency.connect(sig1).approve(offer.address, config.infiniteAllowance);
      await offer.connect(sig1).execute();

      // after execute all draggable shares are transfered to the buyer, if the buyer already had
      // shares they have to be added to compare to the new balance
      expect(await shares.balanceOf(sig1.address)).to.equal(draggableTotal.add(buyerBal));
    });

    afterEach(async () => {
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      if(offer.address !== "") { 
        await offer.connect(sig1).cancel();
      }
    });
  });

  describe("Allowlist", () => {
    it("Should allowlist address and mint", async () => {
      // use sig1 for allowlist
      const allowlistAddress = sig1.address;
      await allowlistShares["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistShares.canReceiveFromAnyone(allowlistAddress)).to.equal(true);
      await allowlistShares.mint(allowlistAddress, "1000");
      const balanceAllow = await allowlistShares.balanceOf(allowlistAddress);
      expect(balanceAllow).to.equal(ethers.BigNumber.from(1000));
    });

    it("Should set forbidden and revert mint", async () => {
      //use sig2 for blacklist
      const forbiddenAddress = sig2.address;
      await allowlistShares["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      expect(await allowlistShares.canReceiveFromAnyone(forbiddenAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(true);

      await expect(allowlistShares.mint(forbiddenAddress, "1000")).to.be.revertedWith("not allowed");
      const balanceForbidden = await allowlistShares.balanceOf(forbiddenAddress);
      expect(balanceForbidden).to.equal(ethers.BigNumber.from(0));
    });

    it("Should set allowlist for default address when minted from powerlisted", async () => {
      //use sig3 for default address
      const defaultAddress = sig3.address
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);

      await allowlistShares.mint(defaultAddress, "1000");
      const balancedef = await allowlistShares.balanceOf(defaultAddress);
      expect(balancedef).to.equal(ethers.BigNumber.from(1000));
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(true);      
    });
  });

  describe("Allowlist Draggable", () => {
    it("Should allow wrap on allowlist", async () => {
      // use sig1 for allowlist
      const allowlistAddress = sig1.address;
      await allowlistDraggable["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistDraggable.canReceiveFromAnyone(allowlistAddress)).to.equal(true);

      // wrap w/o permission should revert
      await expect(allowlistDraggable.connect(sig1).wrap(allowlistAddress, "10"))
        .to.be.revertedWith("not allowed");

      // set allowlist on shares
      await allowlistShares["setType(address,uint8)"](allowlistDraggable.address, TYPE_ALLOWLISTED);
      // set allowance
      await allowlistShares.connect(sig1).approve(allowlistDraggable.address, config.infiniteAllowance);
      // wrap w/ permisson 
      await allowlistDraggable.connect(sig1).wrap(allowlistAddress, "10");
      const balanceAllow = await allowlistDraggable.balanceOf(allowlistAddress);
      expect(balanceAllow).to.equal(ethers.BigNumber.from(10));
    });

    it("Should revert wrap to forbidden", async () => {
      //use sig2 for blacklist
      const forbiddenAddress = sig2.address;

      // mint shares
      await allowlistShares["setType(address,uint8)"](forbiddenAddress, TYPE_ALLOWLISTED);
      await allowlistShares.mint(forbiddenAddress, "1000");

      // set forbidden on draggable
      await allowlistDraggable["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      
      // set allowance
      await allowlistShares.connect(sig2).approve(allowlistDraggable.address, config.infiniteAllowance);

      // excpect revert on wrap
      await expect(allowlistDraggable.connect(sig2).wrap(forbiddenAddress, "10"))
        .to.be.revertedWith("not allowed");
      const balanceForbidden = await allowlistDraggable.balanceOf(forbiddenAddress);
      expect(balanceForbidden).to.equal(ethers.BigNumber.from(0));
    });

    it("Should set allowlist for default address when wrapped from powerlisted", async () => {
      // mint for powerlisted
      await allowlistShares["setType(address,uint8)"](owner.address, TYPE_POWERLISTED);
      await allowlistShares.mint(owner.address, "1000");

      //use sig3 for default address
      const defaultAddress = sig3.address
      expect(await allowlistDraggable.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistDraggable.isForbidden(defaultAddress)).to.equal(false);

      // set allowance
      await allowlistShares.approve(allowlistDraggable.address, config.infiniteAllowance);
      await allowlistDraggable.wrap(defaultAddress, "10");
      expect(await allowlistDraggable.canReceiveFromAnyone(defaultAddress)).to.equal(true);     
    });
  });
});