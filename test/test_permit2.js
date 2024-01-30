const { ethers} = require("hardhat");
const { expect } = require("chai");
const { setup, getBlockTimeStamp, randomBigInt } = require("./helper/index");
const { time }  = require("@nomicfoundation/hardhat-network-helpers");

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Permit2", () => {
  let draggable;
  let shares;
  let recoveryHub;
  let offerFactory;
  let paymentHub;
  let brokerbot;
  let allowlistShares;
  let allowlistDraggable;
  let baseCurrency;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let oracle;
  let chainid;

  const PERMIT_ENABLED = 1;
  const PERMIT_DISABLED = 2;

  before(async() => {
    chainid = (await ethers.provider.getNetwork()).chainId;
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
  });

  beforeEach(async() => {
    // get deployments
    await deployments.fixture(["Shares", "DraggableShares"]);
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
  });

  describe("Permit2 on Shares", () =>{
    it("Should have infinit allowance after deployment", async () => {
      // do check of all accounts 
      for (let i = 0; i < accounts.length; i++) {
        const element = accounts[i];
        const sharesAllowance = await shares.allowance(element, config.permit2Address);
        expect(sharesAllowance).to.be.equal(ethers.MaxUint256)                
      }
      
    });
    it("Should be only be en/disable from owner", async () => {
      expect(await shares.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
      await expect(shares.connect(sig1).togglePermit2()).to.be.revertedWithCustomError(shares, "Ownable_NotOwner");
      expect(await shares.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
    });
    it("Should be en/disablable for all by owner", async () => {
      expect(await shares.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
      await shares.connect(owner).togglePermit2();
      expect(await shares.permit2Enabled()).to.be.equal(PERMIT_DISABLED);
      const sharesAllowanceDisabled = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceDisabled).to.be.equal(0);
      await shares.connect(owner).togglePermit2();
      expect(await shares.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
      const sharesAllowanceEnabled = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceEnabled).to.be.equal(ethers.MaxUint256);
    });
    it("Should be en/disablable individually by share holder", async () => {});
  });
  
  describe("Permit2 on DraggableShares", () => {
    it("Should have infinit allowance of DraggableShares", async () => {});
    it("Should be en/disablable for all by oracle", async () => {});
    it("Should be en/disablable indidvidually by share holder", async () => {});
  })

});