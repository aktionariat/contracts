const { ethers} = require("hardhat");
const { expect } = require("chai");
const { setup } = require("./helper/index");
// Shared  Config
const config = require("../scripts/deploy_config_polygon.js");

describe("Migration", () => {
  let draggable;
  let shares;
  let successor;
  let successorExternal;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let signers;
  beforeEach(async() => {
    // deploy contracts and set up signers
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];

    // deploy contracts
    await setup(false);

    // get references
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    successor = await ethers.getContract("DraggableSharesWithPredecessor");
    successorExternal = await ethers.getContract("DraggableSharesWithPredecessorExternal");
  })

  describe("Deploy successor", () => {
    it("Should deploy successor contact", async () => {
      expect(await successor.getAddress()).to.exist;
      expect(await successorExternal.getAddress()).to.exist;
    })
  })

  describe("Migration", () => {
    it("Should revert when not enough predecessor tokens are on the successor", async () => {
      await expect(successor.initiateMigration()).to.be.revertedWithCustomError(draggable, "Draggable_QuorumNotReached")
        .withArgs(75000000000, await successor.totalSupply());
    })
    it("Should revert if there is an open offer", async () => {
      const overrides = {
        value: ethers.parseEther("6000.0")
      }
      pricePerShare = ethers.parseUnits("2", 18);
      salt = ethers.encodeBytes32String('1');
      await draggable.connect(sig1).makeAcquisitionOffer(salt, pricePerShare, config.baseCurrencyAddress, overrides)
      await expect(successor.initiateMigration()).to.be.revertedWithCustomError(draggable, "Draggable_OpenOffer");
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      await offer.connect(sig1).cancel();
    })
    it("Should revert when more yes votes than total shares", async () => {
      // move token to successor
      let balance1 = await draggable.balanceOf(sig2.address);
      let tokenToMint = balance1 * 4n;
      await shares.connect(owner).mintAndCall(sig2.address, await draggable.getAddress(), tokenToMint, "0x01");
      await draggable.connect(sig2).approve(await successor.getAddress(), config.infiniteAllowance);
      await successor.connect(sig2).wrap(sig2.address, tokenToMint);      
      // declare token invalid to set total shares lower
      const invalidAmount = await draggable.totalSupply();
      const totalShares = await shares.totalShares();
      await shares.connect(owner).declareInvalid(await draggable.getAddress(), invalidAmount, "0x01");
      await shares.connect(owner).setTotalShares(600000);
      // call migrate with too many votes
      await expect(successor.initiateMigration()).to.be.revertedWithCustomError(draggable, "Draggable_TooManyVotes")
        .withArgs(await shares.totalShares(), await draggable.balanceOf(await successor.getAddress()));
      await shares.connect(owner).setTotalShares(totalShares);
    })
    it("Should migrate successfully", async () => {
      let votingToken = await draggable.totalVotingTokens();
      let balance1 = await draggable.balanceOf(sig2.address); // 900'000
      let tokenToMint = balance1 * 4n; // 3'600'000
      // mint shares and wrap them in draggable
      await shares.connect(owner).mintAndCall(sig2.address, await draggable.getAddress(), tokenToMint, "0x01");
      // move enough shares to successor (5*900'000 = 4'500'000)
      for( let i = 1; i < signers.length; i++) {
        await draggable.connect(signers[i]).approve(await successor.getAddress(), config.infiniteAllowance);
        await successor.connect(signers[i]).wrap(signers[i].address, balance1);
      }
      await successor.connect(sig2).wrap(sig2.address, tokenToMint); 
      // total wrap 4'500'000+3'600'000=8'100'000 > quorum 75%
      //migrate
      await successor.initiateMigration();
      let votingTokenSuccessor = await successor.totalVotingTokens();
      expect(votingToken).to.be.equal(votingTokenSuccessor);
      expect(await successor.wrapped()).to.be.equal(await shares.getAddress());
      expect(await draggable.unwrapConversionFactor()).to.be.equal(1);
    })
  })
  describe("Migration with external votes", () => {
    it("Should revert when migrateWithExternalApproval is called not from oracle", async () => {
      await expect(draggable.connect(sig1).migrateWithExternalApproval(await successorExternal.getAddress(), 1000))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig1.address);
    })
    it("Should revert when more external votes are reported as possible", async () => {
      await expect(draggable.connect(owner).migrateWithExternalApproval(await successorExternal.getAddress(), 10000000000))
        .to.be.revertedWithCustomError(draggable, "Draggable_TooManyVotes")
        .withArgs(await draggable.totalVotingTokens(), 10005400000);
    })
    it("Should migrate with external votes succesfully", async () => {
      const votingToken = await draggable.totalVotingTokens();
      const balSigner = await draggable.balanceOf(sig2.address);
      // change owner to succesor, so that it can mint and transfer token to draggable
      await draggable.connect(owner).setOracle(await successorExternal.getAddress());

      // move current draggable shares to successor (amount: 5400000)
      for( let i = 0; i < signers.length; i++) {
        await draggable.connect(signers[i]).approve(await successorExternal.getAddress(), config.infiniteAllowance);
        await successorExternal.connect(signers[i]).wrap(signers[i].address, balSigner);
      }
      const externalVotes = 3000000; // makes total 8400000 which is over the 75% quorum
      // check only oracle can call migration
      await expect(successorExternal.initiateMigrationWithExternalApproval(externalVotes))
        .to.be.revertedWithCustomError(successorExternal, "ERC20InvalidSender")
        .withArgs(deployer.address);
      // migrate
      await successorExternal.connect(owner).initiateMigrationWithExternalApproval(externalVotes);
      const votingTokenSuccessor = await successorExternal.totalVotingTokens();
      expect(votingToken).to.be.equal(votingTokenSuccessor);
      expect(await successorExternal.wrapped()).to.be.equal(await shares.getAddress());
      expect(await draggable.unwrapConversionFactor()).to.be.equal(1);
      // check if oracle can be set on predecessor
      expect(await draggable.oracle()).to.be.equal(await successorExternal.getAddress());
      await expect(successorExternal.setPredecessorOracle(owner.address))
        .to.be.revertedWithCustomError(successor, "ERC20InvalidSender")
        .withArgs(deployer.address);
      await successorExternal.connect(owner).setPredecessorOracle(owner.address);
      expect(await draggable.oracle()).to.be.equal(owner.address);
    })
  })

  describe("Migration from non-tokenized draggable", () => {
    let migrationShare;
    beforeEach(async () => {
      //redeploy shares,draggable contracts
      await deployments.fixture([
        "Shares",
        "DraggableShares",
        "DraggableSharesWithPredecessorExternal",
        "SharesMigration"
      ]);
      shares = await ethers.getContract("Shares");
      draggable = await ethers.getContract("DraggableShares");
      successorExternal = await ethers.getContract("DraggableSharesWithPredecessorExternal");
      migrationShare = await ethers.getContract("SharesMigration");
    })
    it("Should migrate with to non draggable with predecossor with only external votes successfully", async () => {
      const totalshares = await shares.totalShares();
      await expect(draggable.connect(owner).migrateWithExternalApproval(await migrationShare.getAddress(), totalshares))
        .to.emit(draggable, "NameChanged")
        .withArgs("Migration Shares SHA", "MSS");
      expect(await draggable.wrapped()).to.be.equal(await migrationShare.getAddress());
      expect(await draggable.name()).to.be.equal("Migration Shares SHA");
      expect(await draggable.symbol()).to.be.equal("MSS");
    })
    it("Should migrate with to draggable with predecossor with only external votes successfully", async () => {
      const totalshares = await shares.totalShares();
      await draggable.connect(owner).setOracle(await successorExternal.getAddress());
      expect(await successorExternal.wrapped()).to.be.equal(await draggable.getAddress());
      await successorExternal.connect(owner).initiateMigrationWithExternalApproval(totalshares);
      expect(await draggable.name()).to.be.equal("Test Shares SHA SHA");
      expect(await draggable.symbol()).to.be.equal("SHRSS");
      expect(await draggable.wrapped()).to.be.equal(await successorExternal.getAddress());
      expect(await successorExternal.wrapped()).to.be.equal(await shares.getAddress());
    })
  })
})
