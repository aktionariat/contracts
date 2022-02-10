const {network, ethers, getNamedAccounts} = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");
const { mintBaseCurrency, mintERC20, setBalance } = require("./helper/index");
// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("New Standard", () => {
  let draggable
  let shares
  let recoveryHub;
  let baseCurrency;
  let brokerbot;
  let paymentHub;
  let offerFactory
  let allowlistShares;
  let allowlistDraggable;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
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
  const TYPE_POWERLISTED = 4;

  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    oracle = owner;
    chance = new Chance();

    // deploy contracts
    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);

    await deployments.fixture([
      "ReoveryHub",
      "OfferFactory",
      "Shares",
      "DraggableShares",
      "AllowlistShares",
      //"AllowlistDraggableShares",
      "PaymentHub",
      "Brokerbot"
    ]);

    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    allowlistShares = await ethers.getContract("AllowlistShares");
    //allowlistDraggable = await ethers.getContract("AllowlistDraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");

    // coverage has a problem with deplyoing this contract via hardhat-deploy
    allowlistDraggable = await ethers.getContractFactory("AllowlistDraggableShares")
      .then(factory => factory.deploy(config.allowlist_terms, allowlistShares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, oracle.address, owner.address))
      .then(contract => contract.deployed());

    
    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);

    //Mint shares to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await shares.connect(owner).mint(accounts[i], 1000000);
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
        expect(await shares.name()).to.equal(config.name);
        expect(await shares.symbol()).to.equal(config.symbol);
        expect(await shares.terms()).to.equal(config.terms);
      });

      it("Should set the right owner", async () =>{
        expect(await shares.owner()).to.equal(owner.address);
      });

      it("Should get right claim deleter", async () => {
        expect(await shares.getClaimDeleter()).to.equal(owner.address);
      });
    });

    describe("Draggable Shares", () => {
      it("Should deploy contracts", async () => {
        expect(draggable.address).to.exist;
      });
  
      it("Should have params specified at the constructor", async() => {
        expect(await draggable.terms()).to.equal(config.terms);
      }); 

      it("Should get right claim deleter", async () => {
        expect(await draggable.getClaimDeleter()).to.equal(oracle.address);
      });
    });

    describe("AllowlistShares", () => {
      it("Should deploy allowlist shares", async () => {
        expect(allowlistShares.address).to.exist;
      });

      it("Should have params specified at the constructor", async() => {
        expect(await allowlistShares.name()).to.equal(config.allowlist_name);
        expect(await allowlistShares.symbol()).to.equal(config.allowlist_symbol);
        expect(await allowlistShares.terms()).to.equal(config.allowlist_terms);
      }); 
    });

    describe("Allowlist Draggable Shares", () => {
      it("Should deploy contracts", async () => {
        expect(allowlistDraggable.address).to.exist;
      });

      it("Should have params specified at the constructor", async() => {
        expect(await allowlistDraggable.terms()).to.equal(config.allowlist_terms);
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

  describe("Shares", () => {
    it("Should set custom claim collateral for shares", async () => {
      const collateralAddress = config.baseCurrencyAddress;
      const collateralRate = 10;
      // test that only owenr can set
      await expect(shares.connect(sig1).setCustomClaimCollateral(collateralAddress, collateralRate))
      .to.be.revertedWith("not owner");
      // test with owner
      await shares.connect(owner).setCustomClaimCollateral(collateralAddress, collateralRate);
      expect(await shares.customCollateralAddress()).to.equal(collateralAddress);
      expect(await shares.customCollateralRate()).to.equal(collateralRate);
    });

    it("Should change terms for shares", async () => {
      const newTerms = "www.test.com/newterms";
      await shares.connect(owner).setTerms(newTerms);

      // check if terms set correct
      expect(await shares.terms()).to.equal(newTerms);
    });

    it("Should emit event for shares announcment", async () => {
      const message = "Test";
      await expect(shares.connect(owner).announcement(message))
        .to.emit(shares, 'Announcement')
        .withArgs(message);
    });

    it("Should set new name", async () => {
      const newName = "New Shares";
      const newSymbol = "NSHR"
      await shares.connect(owner).setName(newSymbol, newName);
      expect(await shares.name()).to.equal(newName);
      expect(await shares.symbol()).to.equal(newSymbol);
    })

    it("Should set custom claim collateral for shares", async () => {
      const collateralAddress = config.baseCurrencyAddress;
      const collateralRate = 10;
      // test that only owenr can set
      await expect(shares.connect(sig1).setCustomClaimCollateral(collateralAddress, collateralRate))
        .to.be.revertedWith("not owner");
      // test with owner
      await shares.connect(owner).setCustomClaimCollateral(collateralAddress, collateralRate);
      expect(await shares.customCollateralAddress()).to.equal(collateralAddress);
      expect(await shares.customCollateralRate()).to.equal(collateralRate);
    });

    it("Should change terms for shares", async () => {
      const newTerms = "www.test.com/newterms";
      await shares.connect(owner).setTerms(newTerms);

      // check if terms set correct
      expect(await shares.terms()).to.equal(newTerms);
    });

    it("Should set new total shares", async () => {
      const randomChange = chance.natural({ min: 1, max: 50000 });
      const totalSupply = await shares.totalValidSupply();
      let newTotalShares = await totalSupply.add(randomChange);

      // should revert if new total shares is < than valid supply
      await expect(shares.connect(owner).setTotalShares(await totalSupply.sub(randomChange)))
      .to.be.revertedWith("below supply");

      // set correct new total and check if set correct
      await shares.connect(owner).setTotalShares(totalSupply.add(randomChange));
      const totalShares = await shares.totalShares();
      expect(totalShares).to.equal(totalSupply.add(randomChange));
    });

    it("Should declare tokens invalid", async () => {
      const randomdAmount = chance.natural({ min: 1, max: 50000 });
      const invalidTokenBefore = await shares.invalidTokens();
      const holderBalance = await shares.balanceOf(sig4.address);

      // try to declare too many tokens invalid
      await expect(shares.connect(owner).declareInvalid(sig4.address, holderBalance.add(1), "more than I have"))
        .to.be.revertedWith("amount too high");

      await expect(shares.connect(owner).declareInvalid(sig4.address, randomdAmount, "test"))
        .to.emit(shares, "TokensDeclaredInvalid")
        .withArgs(sig4.address, randomdAmount, "test");

      const invalidTokenAfter = await shares.invalidTokens();
      expect(invalidTokenBefore.add(randomdAmount)).to.equal(invalidTokenAfter);
    });

    it("Should burn shares", async () => {
      const randomAmountToBurn = chance.natural({min:1, max: 5000});
      const balanceBefore = await shares.balanceOf(sig3.address);
      await shares.connect(sig3).burn(randomAmountToBurn);
      const balanceAfter = await shares.balanceOf(sig3.address);
      expect(balanceBefore.sub(randomAmountToBurn)).to.equal(balanceAfter);
    });

    it("Should mint and call on shares", async () => {
      const randomAmountToMint = chance.natural({min:1, max: 5000});
      const totalShares = await shares.totalShares();

      //set new total shares as we mint more
      await shares.connect(owner).setTotalShares(totalShares.add(randomAmountToMint));
      const balanceBefore = await draggable.balanceOf(sig2.address);
      // mint shares and wrap them in draggable
      await shares.connect(owner).mintAndCall(sig2.address, draggable.address, randomAmountToMint, "0x01");
      const balanceAfter = await draggable.balanceOf(sig2.address);

      expect(balanceBefore.add(randomAmountToMint)).to.equal(balanceAfter);
    });

    it("Should wrap some more shares with transferAndCall", async () => {
      const randomAmountToWrap = chance.natural({min: 1, max: 500});
      const balanceBefore = await draggable.balanceOf(sig1.address);
      await shares.connect(sig1).transferAndCall(draggable.address, randomAmountToWrap, "0x01");
      const balanceAfter = await draggable.balanceOf(sig1.address);
      expect(balanceBefore.add(randomAmountToWrap)).to.equal(balanceAfter);
    })
  });

  describe("Draggable Shares", () => {
    it("Should set new oracle", async () => {
      const newOracle = sig1.address;
      await draggable.connect(oracle).setOracle(newOracle);
      //expect(await draggable.oracle()).to.equal(newOracle);
      // reset oracle for for offer testing
      await draggable.connect(sig1).setOracle(owner.address);
    });

    it("Should burn draggable shares", async () => {
      const randomAmountToBurn = chance.natural({min:1, max: 5000});
      const balanceBefore = await shares.balanceOf(draggable.address);
      const balanceBeforeDraggable = await draggable.balanceOf(sig3.address);
      const totalSupplyBefore = await shares.totalSupply();

      // burn token which burns also shares which are in the drraggable contract
      // and reduces supply from shares
      await draggable.connect(sig3).burn(randomAmountToBurn);
      const balanceAfter = await shares.balanceOf(draggable.address);
      const balanceAfterDraggable = await draggable.balanceOf(sig3.address);
      const totalSupplyArfter= await shares.totalSupply();
      expect(balanceBeforeDraggable.sub(randomAmountToBurn)).to.equal(balanceAfterDraggable);
      expect(balanceBefore.sub(randomAmountToBurn)).to.equal(balanceAfter);
      expect(totalSupplyBefore.sub(randomAmountToBurn)).to.equal(totalSupplyArfter);
    })
  });

  describe("Recovery", () => {
    it("Should able to disable recovery", async () => {
      const recovery = await ethers.getContractAt("RecoveryHub", await draggable.recovery());
      await recovery.connect(sig1).setRecoverable(false);
      expect(await recoveryHub.isRecoverable(sig1.address)).to.equal(false);
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
        value: ethers.utils.parseEther("5.0")
      }
      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('2'), ethers.utils.parseEther("1"), baseCurrency.address, overrides))
        .to.revertedWith("old offer better");
      await draggable.connect(sig1).makeAcquisitionOffer(ethers.utils.formatBytes32String('2'), ethers.utils.parseEther("2.3"), baseCurrency.address, overrides);
      
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
      const externalTokens = ethers.BigNumber.from(100000);
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
      await allowlistShares.connect(owner)["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistShares.canReceiveFromAnyone(allowlistAddress)).to.equal(true);
      await allowlistShares.connect(owner).mint(allowlistAddress, "1000");
      const balanceAllow = await allowlistShares.balanceOf(allowlistAddress);
      expect(balanceAllow).to.equal(ethers.BigNumber.from(1000));
    });

    it("Should set forbidden and revert mint", async () => {
      //use sig2 for blacklist
      const forbiddenAddress = sig2.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      expect(await allowlistShares.canReceiveFromAnyone(forbiddenAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(true);

      await expect(allowlistShares.connect(owner).mint(forbiddenAddress, "1000")).to.be.revertedWith("not allowed");
      const balanceForbidden = await allowlistShares.balanceOf(forbiddenAddress);
      expect(balanceForbidden).to.equal(ethers.BigNumber.from(0));
    });

    it("Should set allowlist for default address when minted from 0 (powerlisted)", async () => {
      //use sig3 for default address
      const defaultAddress = sig3.address
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);

      await allowlistShares.connect(owner).mint(defaultAddress, "1000");
      const balancedef = await allowlistShares.balanceOf(defaultAddress);
      expect(balancedef).to.equal(ethers.BigNumber.from(1000));
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(true);      
    });

    it("Should set powerlist to not owner and transfer token to default", async () => {
      //set adr/sig1 as powerlist
      const powerlistAddress = sig1.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](powerlistAddress, TYPE_POWERLISTED);
      expect(await allowlistShares.isPowerlisted(powerlistAddress)).to.equal(true);

      // powerlist can't mint
      await expect(allowlistShares.connect(sig1).mint(powerlistAddress, "1000")).to.be.revertedWith("not owner");

      // mint to powerlist
      await await allowlistShares.connect(owner).mint(powerlistAddress, "1000");

      //use sig4 for default address
      const defaultAddress = sig4.address
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isPowerlisted(defaultAddress)).to.equal(false);

      // transfer from powerlist to default(sig4)
      const balanceBefore = await allowlistShares.balanceOf(defaultAddress);
      await allowlistShares.connect(sig1).transfer(defaultAddress, "1000");
      const balanceAfter = await allowlistShares.balanceOf(defaultAddress);
      expect(balanceBefore.add(1000)).to.equal(balanceAfter);
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(true);
    });

    it("Should mint and call on allowlistShares to allowlistDraggable", async () => {
      const randomAmountToMint = chance.natural({min:1, max: 5000});
      const totalShares = await allowlistShares.totalShares();

      //set new total shares as we mint more
      await allowlistShares.connect(owner).setTotalShares(totalShares.add(randomAmountToMint));
      const balanceBefore = await allowlistDraggable.balanceOf(sig5.address);
      // mint shares and wrap them in draggable
      await allowlistShares.connect(owner).mintAndCall(sig5.address, allowlistDraggable.address, randomAmountToMint, "0x01");
      const balanceAfter = await allowlistDraggable.balanceOf(sig5.address);

      expect(balanceBefore.add(randomAmountToMint)).to.equal(balanceAfter);
    });
  });

  describe("Allowlist Draggable", () => {
    it("Should allow wrap on allowlist", async () => {
      // use sig1 for allowlist
      const allowlistAddress = sig1.address;
      await allowlistDraggable.connect(owner)["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistDraggable.canReceiveFromAnyone(allowlistAddress)).to.equal(true);
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
      await allowlistShares.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_ALLOWLISTED);
      await allowlistShares.connect(owner).mint(forbiddenAddress, "1000");

      // set forbidden on draggable
      await allowlistDraggable.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      
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
      await allowlistShares.connect(owner)["setType(address,uint8)"](owner.address, TYPE_POWERLISTED);
      await allowlistShares.connect(owner).mint(owner.address, "1000");

      //use sig3 for default address
      const defaultAddress = sig3.address
      expect(await allowlistDraggable.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistDraggable.isForbidden(defaultAddress)).to.equal(false);

      // set allowance
      await allowlistShares.connect(owner).approve(allowlistDraggable.address, config.infiniteAllowance);
      await allowlistDraggable.connect(owner).wrap(defaultAddress, "10");
      expect(await allowlistDraggable.canReceiveFromAnyone(defaultAddress)).to.equal(true);     
    });
  });

  describe("Remove restriction", () => {
    it("Should remove restriction", async () => {
      // restrict should be true
      expect(await allowlistShares.restrictTransfers()).to.equal(true);

      // can only be set by owner
      await expect(allowlistShares.setApplicable(false)).to.be.revertedWith("not owner");

      await allowlistShares.connect(owner).setApplicable(false);

      // restrict should be false
      expect(await allowlistShares.restrictTransfers()).to.equal(false);

    });

    it("Should clean forbidden address after removed restriction", async () => {
      //use sig2 for blacklist
      const forbiddenAddress = sig2.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(true);

      await allowlistShares.connect(owner).mint(forbiddenAddress, "1000");

      //check if is now default
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(false);
      expect(await allowlistShares.canReceiveFromAnyone(forbiddenAddress)).to.equal(false);

    });

    it("Should clean allowlist address after removed restriction", async () => {
      //use sig1 for allowlist
      const allowlistAddress = sig1.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistShares.canReceiveFromAnyone(allowlistAddress)).to.equal(true);

      //use sig3 as default
      const defaultAddress = sig3.address
      await allowlistShares.connect(owner)["setType(address,uint8)"](defaultAddress, TYPE_DEFAULT);
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);

      await allowlistShares.connect(sig1).transfer(sig3.address, "10");
      expect(await allowlistShares.canReceiveFromAnyone(allowlistAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(allowlistAddress)).to.equal(false);

    });
  })

});
