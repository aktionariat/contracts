const { ethers} = require("hardhat");
const { expect } = require("chai");
const { getImpersonatedSigner } = require("./helper/index");
const { time }  = require("@nomicfoundation/hardhat-network-helpers");

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Permit2", () => {
  let draggable;
  let shares;
  let permit2Hub;
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
    await deployments.fixture(["Permit2Hub", "Shares", "DraggableShares"]);
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    permit2Hub = await ethers.getContract("Permit2Hub");
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
    it("Should revert if en/disable from non-owner", async () => {
      expect(await permit2Hub.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
      await expect(permit2Hub.connect(sig1).togglePermit2()).to.be.revertedWithCustomError(shares, "Ownable_NotOwner");
      expect(await permit2Hub.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
    });
    it("Should be en/disablable for all by owner", async () => {
      const { trustedForwarder } = await getNamedAccounts();
      const permit2HubOwner = await getImpersonatedSigner(trustedForwarder);
      expect(await permit2Hub.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      expect(await permit2Hub.permit2Enabled()).to.be.equal(PERMIT_DISABLED);
      const sharesAllowanceDisabled = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceDisabled).to.be.equal(0n);
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      expect(await permit2Hub.permit2Enabled()).to.be.equal(PERMIT_ENABLED);
      const sharesAllowanceEnabled = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceEnabled).to.be.equal(ethers.MaxUint256);
    });
    it("Should be en/disablable individually by share holder", async () => {
      // check init state
      let sharesAllowanceSig1 = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceSig1).to.be.equal(ethers.MaxUint256);
      let sharesAllowanceSig2 = await shares.allowance(sig2.address, config.permit2Address);
      expect(sharesAllowanceSig2).to.be.equal(ethers.MaxUint256);
      // change for user sig1
      await permit2Hub.connect(sig1).setPermit2(false);
      // check state after
      sharesAllowanceSig1 = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceSig1).to.be.equal(0n);
      sharesAllowanceSig2 = await shares.allowance(sig2.address, config.permit2Address);
      expect(sharesAllowanceSig2).to.be.equal(ethers.MaxUint256);
    });
  });
  
  describe("Permit2 on DraggableShares", () => {
    it("Should have infinit allowance of DraggableShares", async () => {});
    it("Should be en/disablable for all by oracle", async () => {});
    it("Should be en/disablable indidvidually by share holder", async () => {});
  })

});