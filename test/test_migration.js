const { ethers} = require("hardhat");
const { expect } = require("chai");
const { setup } = require("./helper/index");
// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Migration", () => {
  let draggable;
  let shares;
  let successor;

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
  })

  describe("Deploy successor", () => {
    it("Should deploy successor contact", async () => {
      expect(successor.address).to.exist;
    })
  })

  describe("Migration", () => {
    it("Should revert when not enough predecessor tokens are on the successor", async () => {
      await expect(successor.initiateMigration()).to.be.revertedWith("quorum");
    })
    it("Should revert if there is an open offer", async () => {
      const overrides = {
        value: ethers.utils.parseEther("5.0")
      }
      pricePerShare = ethers.utils.parseUnits("2", 18);
      salt = ethers.utils.formatBytes32String('1');
      await draggable.connect(sig1).makeAcquisitionOffer(salt, pricePerShare, config.baseCurrencyAddress, overrides)
      await expect(successor.initiateMigration()).to.be.revertedWith("no offer");
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      await offer.connect(sig1).cancel();
    })
    it("Should revert when more yes votes than total shares", async () => {
      // move token to successor
      let balance1 = await draggable.balanceOf(sig2.address);
      let tokenToMint = balance1.mul(4);
      await shares.connect(owner).mintAndCall(sig2.address, draggable.address, tokenToMint, "0x01");
      await draggable.connect(sig2).approve(successor.address, config.infiniteAllowance);
      await successor.connect(sig2).wrap(sig2.address, tokenToMint);      
      // declare token invalid to set total shares lower
      const invalidAmount = await draggable.totalSupply();
      const totalShares = await shares.totalShares();
      await shares.connect(owner).declareInvalid(draggable.address, invalidAmount, "0x01");
      await shares.connect(owner).setTotalShares(600000);
      // call migrate with too many votes
      await expect(successor.initiateMigration()).to.be.revertedWith("votes");
      await shares.connect(owner).setTotalShares(totalShares);
    })
    it("Should migrate successfully", async () => {
      let votingToken = await draggable.totalVotingTokens();
      let balance1 = await draggable.balanceOf(sig2.address); // 900'000
      let tokenToMint = balance1.mul(4); // 3'600'000
      // mint shares and wrap them in draggable
      await shares.connect(owner).mintAndCall(sig2.address, draggable.address, tokenToMint, "0x01");
      // move enough shares to successor (5*900'000 = 4'500'000)
      for( let i = 1; i < signers.length; i++) {
        await draggable.connect(signers[i]).approve(successor.address, config.infiniteAllowance);
        await successor.connect(signers[i]).wrap(signers[i].address, balance1);
      }
      await successor.connect(sig2).wrap(sig2.address, tokenToMint); 
      // total wrap 4'500'000+3'600'000=8'100'000 > quorum 75%
      //migrate
      await successor.initiateMigration();
      let votingTokenSuccessor = await successor.totalVotingTokens();
      expect(votingToken).to.be.equal(votingTokenSuccessor);
      expect(await successor.wrapped()).to.be.equal(shares.address);
      expect(await draggable.unwrapConversionFactor()).to.be.equal(1);
    })
  })
  describe("Migration with external votes", () => {
    it("Should revert when migrateWithExternalApproval is called not from oracle", async () => {
      await expect(draggable.connect(sig1).migrateWithExternalApproval(successor.address, 1000))
        .to.be.revertedWith("not oracle");
    })
    it("Should revert when more external votes are reported as possible", async () => {
      await expect(draggable.connect(owner).migrateWithExternalApproval(successor.address, 10000000000))
        .to.be.revertedWith("votes");
    })
    it("Should migrate with external votes succesfully", async () => {
      const votingToken = await draggable.totalVotingTokens();
      const balSigner = await draggable.balanceOf(sig2.address);
      // change owner to succesor, so that it can mint and transfer token to draggable
      await draggable.connect(owner).setOracle(successor.address);

      // move current draggable shares to successor (amount: 5400000)
      for( let i = 0; i < signers.length; i++) {
        await draggable.connect(signers[i]).approve(successor.address, config.infiniteAllowance);
        await successor.connect(signers[i]).wrap(signers[i].address, balSigner);
      }
      const externalVotes = 3000000; // makes total 8400000 which is over the 75% quorum
      await successor.connect(owner).initiateMigrationWithExternalApproval(externalVotes);
      const votingTokenSuccessor = await successor.totalVotingTokens();
      expect(votingToken).to.be.equal(votingTokenSuccessor);
      expect(await successor.wrapped()).to.be.equal(shares.address);
      expect(await draggable.unwrapConversionFactor()).to.be.equal(1);
    })
  })
})
