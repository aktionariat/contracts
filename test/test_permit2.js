const { ethers} = require("hardhat");
const { expect } = require("chai");
const { getImpersonatedSigner } = require("./helper/index");
const { time }  = require("@nomicfoundation/hardhat-network-helpers");

// Shared  Config
const config = require("../scripts/deploy_config_polygon.js");

describe("Permit2", () => {
  let draggable;
  let shares;
  let permit2Hub;
  let offerFactory;
  let allowlistShares;
  let allowlistDraggable;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let chainid;

  before(async() => {
    chainid = (await ethers.provider.getNetwork()).chainId;
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
  });

  beforeEach(async() => {
    // get deployments
    await deployments.fixture(["Permit2Hub", "Shares", "DraggableShares", "AllowlistShares", "RecoveryHub", "OfferFactory"]);
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    allowlistShares = await ethers.getContract("AllowlistShares");
    permit2Hub = await ethers.getContract("Permit2Hub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");

    // coverage has a problem with deplyoing this contract via hardhat-deploy
    let recoveryHubAddress = await recoveryHub.getAddress();
    let offerFactoryAddress = await offerFactory.getAddress();
    let allowlistSharesAddress = await allowlistShares.getAddress();
    const draggableParams = {
      wrappedToken: allowlistSharesAddress,
      quorumDrag: config.quorumBps,
      quorumMigration: config.quorumMigration,
      votePeriod: config.votePeriodSeconds
    }
    allowlistDraggable = await ethers.deployContract("AllowlistDraggableShares", [config.allowlist_terms, draggableParams, recoveryHubAddress, offerFactoryAddress, owner.address, permit2Hub.getAddress()]);
    await allowlistDraggable.waitForDeployment();
  });

  describe("Permit2 Hub", () => {
    it("Should revert if en/disable from non-owner", async () => {
      expect(await permit2Hub.permit2Disabled()).to.be.equal(false);
      await expect(permit2Hub.connect(sig1).togglePermit2()).to.be.revertedWithCustomError(shares, "Ownable_NotOwner");
      expect(await permit2Hub.permit2Disabled()).to.be.equal(false);
    });

    it("Should be en/disablable for all by trusted owner", async () => {
      // get owner
      const { trustedForwarder } = await getNamedAccounts();
      const permit2HubOwner = await getImpersonatedSigner(trustedForwarder);
      // check state before
      expect(await permit2Hub.permit2Disabled()).to.be.equal(false);
      // change state to disable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      expect(await permit2Hub.permit2Disabled()).to.be.equal(true);
      // change state back to enable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      expect(await permit2Hub.permit2Disabled()).to.be.equal(false);
    });
  })

  describe("Permit2 on Shares", () =>{
    it("Should have infinit allowance after deployment", async () => {
      // do check of all accounts 
      for (let i = 0; i < accounts.length; i++) {
        const element = accounts[i];
        const sharesAllowance = await shares.allowance(element, config.permit2Address);
        expect(sharesAllowance).to.be.equal(ethers.MaxUint256)                
      }
    });

    it("Should have no allowance for non-permit2 spender", async () => {
      const sharesAllowance = await shares.allowance(sig1.address, sig2.address);
      expect(sharesAllowance).to.be.equal(0n);
    });

    it("Should be en/disablable for all by trusted owner", async () => {
      // get owner
      const { trustedForwarder } = await getNamedAccounts();
      const permit2HubOwner = await getImpersonatedSigner(trustedForwarder);
      // change state to disable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const sharesAllowanceDisabled = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceDisabled).to.be.equal(0n);
      // change state back to enable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const sharesAllowanceEnabled = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceEnabled).to.be.equal(ethers.MaxUint256);
    });

    it("Should be en/disablable individually by share holder", async () => {
      // check init state
      let sharesAllowanceSig1 = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceSig1).to.be.equal(ethers.MaxUint256);
      let sharesAllowanceSig2 = await shares.allowance(sig2.address, config.permit2Address);
      expect(sharesAllowanceSig2).to.be.equal(ethers.MaxUint256);
      // change for user sig1, but ont sig2
      await permit2Hub.connect(sig1).setPermit2(false);
      // check state after
      sharesAllowanceSig1 = await shares.allowance(sig1.address, config.permit2Address);
      expect(sharesAllowanceSig1).to.be.equal(0n);
      sharesAllowanceSig2 = await shares.allowance(sig2.address, config.permit2Address);
      expect(sharesAllowanceSig2).to.be.equal(ethers.MaxUint256);
    });
  });
  
  describe("Permit2 on DraggableShares", () => {
    it("Should have infinit allowance of DraggableShares", async () => {
      // do check of all accounts 
      for (let i = 0; i < accounts.length; i++) {
        const element = accounts[i];
        const draggableSharesAllowance = await draggable.allowance(element, config.permit2Address);
        expect(draggableSharesAllowance).to.be.equal(ethers.MaxUint256)                
      }
    });

    it("Should be en/disablable for all by trusted owner", async () => {
      // get owner
      const { trustedForwarder } = await getNamedAccounts();
      const permit2HubOwner = await getImpersonatedSigner(trustedForwarder);
      // change state to disable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const draggableAllowanceDisabled = await draggable.allowance(sig1.address, config.permit2Address);
      expect(draggableAllowanceDisabled).to.be.equal(0n);
      // change state back to enable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const draggableAllowanceEnabled = await draggable.allowance(sig1.address, config.permit2Address);
      expect(draggableAllowanceEnabled).to.be.equal(ethers.MaxUint256);
    });

    it("Should be en/disablable individually by share holder", async () => {
      // check init state
      let draggableAllowanceSig1 = await draggable.allowance(sig1.address, config.permit2Address);
      expect(draggableAllowanceSig1).to.be.equal(ethers.MaxUint256);
      let draggableAllowanceSig2 = await draggable.allowance(sig2.address, config.permit2Address);
      expect(draggableAllowanceSig2).to.be.equal(ethers.MaxUint256);
      // change for user sig1, but ont sig2
      await permit2Hub.connect(sig1).setPermit2(false);
      // check state after
      draggableAllowanceSig1 = await draggable.allowance(sig1.address, config.permit2Address);
      expect(draggableAllowanceSig1).to.be.equal(0n);
      draggableAllowanceSig2 = await draggable.allowance(sig2.address, config.permit2Address);
      expect(draggableAllowanceSig2).to.be.equal(ethers.MaxUint256);
    });
  });
  
  describe("Permit2 on AllowlistShares", () => {
    it("Should have infinit allowance of DraggableShares", async () => {
      // do check of all accounts 
      for (let i = 0; i < accounts.length; i++) {
        const element = accounts[i];
        const allowlistSharesAllowance = await allowlistShares.allowance(element, config.permit2Address);
        expect(allowlistSharesAllowance).to.be.equal(ethers.MaxUint256)                
      }
    });

    it("Should be en/disablable for all by trusted owner", async () => {
      // get owner
      const { trustedForwarder } = await getNamedAccounts();
      const permit2HubOwner = await getImpersonatedSigner(trustedForwarder);
      // change state to disable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const allowlistSharesAllowanceDisabled = await allowlistShares.allowance(sig1.address, config.permit2Address);
      expect(allowlistSharesAllowanceDisabled).to.be.equal(0n);
      // change state back to enable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const allowlistSharesAllowanceEnabled = await allowlistShares.allowance(sig1.address, config.permit2Address);
      expect(allowlistSharesAllowanceEnabled).to.be.equal(ethers.MaxUint256);
    });

    it("Should be en/disablable individually by share holder", async () => {
      // check init state
      let allowlistSharesAllowanceSig1 = await allowlistShares.allowance(sig1.address, config.permit2Address);
      expect(allowlistSharesAllowanceSig1).to.be.equal(ethers.MaxUint256);
      let allowlistSharesAllowanceSig2 = await allowlistShares.allowance(sig2.address, config.permit2Address);
      expect(allowlistSharesAllowanceSig2).to.be.equal(ethers.MaxUint256);
      // change for user sig1, but ont sig2
      await permit2Hub.connect(sig1).setPermit2(false);
      // check state after
      allowlistSharesAllowanceSig1 = await allowlistShares.allowance(sig1.address, config.permit2Address);
      expect(allowlistSharesAllowanceSig1).to.be.equal(0n);
      allowlistSharesAllowanceSig2 = await allowlistShares.allowance(sig2.address, config.permit2Address);
      expect(allowlistSharesAllowanceSig2).to.be.equal(ethers.MaxUint256);
    });
  });

  describe("Permit2 on AllowistDraggableShares", () => {
    it("Should have infinit allowance of DraggableShares", async () => {
      // do check of all accounts 
      for (let i = 0; i < accounts.length; i++) {
        const element = accounts[i];
        const allowlistDraggableSharesAllowance = await   allowlistDraggable.allowance(element, config.permit2Address);
        expect(allowlistDraggableSharesAllowance).to.be.equal(ethers.MaxUint256)                
      }
    });

    it("Should be en/disablable for all by trusted owner", async () => {
      // get owner
      const { trustedForwarder } = await getNamedAccounts();
      const permit2HubOwner = await getImpersonatedSigner(trustedForwarder);
      // change state to disable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const allowlistDraggableAllowanceDisabled = await allowlistDraggable.allowance(sig1.address, config.permit2Address);
      expect(allowlistDraggableAllowanceDisabled).to.be.equal(0n);
      // change state back to enable
      await permit2Hub.connect(permit2HubOwner).togglePermit2();
      // check state change
      const allowlistDraggableAllowanceEnabled = await allowlistDraggable.allowance(sig1.address, config.permit2Address);
      expect(allowlistDraggableAllowanceEnabled).to.be.equal(ethers.MaxUint256);
    });

    it("Should be en/disablable individually by share holder", async () => {
      // check init state
      let allowlistDraggableAllowanceSig1 = await allowlistDraggable.allowance(sig1.address, config.permit2Address);
      expect(allowlistDraggableAllowanceSig1).to.be.equal(ethers.MaxUint256);
      let allowlistDraggableAllowanceSig2 = await allowlistDraggable.allowance(sig2.address, config.permit2Address);
      expect(allowlistDraggableAllowanceSig2).to.be.equal(ethers.MaxUint256);
      // change for user sig1, but ont sig2
      await permit2Hub.connect(sig1).setPermit2(false);
      // check state after
      allowlistDraggableAllowanceSig1 = await allowlistDraggable.allowance(sig1.address, config.permit2Address);
      expect(allowlistDraggableAllowanceSig1).to.be.equal(0n);
      allowlistDraggableAllowanceSig2 = await allowlistDraggable.allowance(sig2.address, config.permit2Address);
      expect(allowlistDraggableAllowanceSig2).to.be.equal(ethers.MaxUint256);
    });
  });

});
