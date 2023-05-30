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
    await setup();

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
    it("Should migrate successfully", async () => {
      let votingToken = await draggable.totalVotingTokens();
      let balance1 = await draggable.balanceOf(sig2.address);
      let tokenToMint = balance1.mul(4);
      // mint shares and wrap them in draggable
      await shares.connect(owner).mintAndCall(sig2.address, draggable.address, tokenToMint, "0x01");
      // move enough shares to successor
      for( let i = 1; i < signers.length; i++) {
        await draggable.connect(signers[i]).approve(successor.address, config.infiniteAllowance);
        await successor.connect(signers[i]).wrap(signers[i].address, balance1);
      }
      await successor.connect(sig2).wrap(sig2.address, tokenToMint);
      //migrate
      await successor.initiateMigration();
      let votingTokenSuccessor = await successor.totalVotingTokens();
      expect(votingToken).to.be.equal(votingTokenSuccessor);
      expect(await successor.wrapped()).to.be.equal(shares.address);
    })
  })
})
