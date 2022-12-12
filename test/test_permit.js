const { ethers} = require("hardhat");
const { expect } = require("chai");

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Permit", () => {
  let draggable
  let shares
  let recoveryHub;
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
  let oracle;

  /*//////////////////////////////////////////////////////////////
                      EIP-712 Signature 
  //////////////////////////////////////////////////////////////*/
  let domain;
  const permitType = {
    Permit: [
      { name: 'owner', type: 'address', },
      { name: 'spender', type: 'address',},
      { name: 'value', type: 'uint256',},
      { name: 'nonce', type: 'uint256',},
      { name: 'deadline', type: 'uint256',},
    ],
  }
  let domainName;
  let domainVersion = "1"; 
  let chainId = 1 ;
  let contractAddress;

  before(async() => {
    // deploy contracts and set up signers
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    oracle = owner;

    // deploy contracts
    await deployments.fixture([
      "ReoveryHub",
      "OfferFactory",
      "Shares",
      "DraggableShares",
      "AllowlistShares",
    ]);

    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    allowlistShares = await ethers.getContract("AllowlistShares");

    // coverage has a problem with deplyoing this contract via hardhat-deploy
    allowlistDraggable = await ethers.getContractFactory("AllowlistDraggableShares")
      .then(factory => factory.deploy(config.allowlist_terms, allowlistShares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, oracle.address, owner.address))
      .then(contract => contract.deployed());
  })

  /*//////////////////////////////////////////////////////////////
                    Test Permit Shares
  //////////////////////////////////////////////////////////////*/
  describe("Permit Shares", () => {
    before(async() => {
      domainName = await shares.name();
      contractAddress = shares.address;
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await shares.DOMAIN_SEPARATOR())
        .to.equal(ethers.utils._TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowance of shares via permit", async() => {
      // sign permit with sig2
      const nonce = await shares.connect(sig2).nonces(sig2.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 123;
      const spender = sig1.address;
      const permitOwner = sig2.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await sig2._signTypedData(domain, permitType, permitValue));

      // execute permit with sig1
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(0)
      await shares.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.constants.MaxUint256,
        v,
        r,
        s
        )
      // check allowance of sig2
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(value)
    });
  });

  /*//////////////////////////////////////////////////////////////
                Test Permit Draggable Shares
  //////////////////////////////////////////////////////////////*/
  describe("Permit Draggable Shares", () => {
    before(async() => {
      domainName = await draggable.name();
      contractAddress = draggable.address;
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await draggable.DOMAIN_SEPARATOR())
        .to.equal(ethers.utils._TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowanceof draggable shares via permit", async() => {
      // sign permit with sig2
      const nonce = await draggable.connect(sig2).nonces(sig2.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 432;
      const spender = sig1.address;
      const permitOwner = sig2.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await sig2._signTypedData(domain, permitType, permitValue));
      // execute permit with sig1
      expect(await draggable.allowance(permitOwner, spender)).to.be.eq(0)
      await draggable.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.constants.MaxUint256,
        v,
        r,
        s
        )
      // check allowance of sig2
      expect(await draggable.allowance(permitOwner, spender)).to.be.eq(value)
    });
  })

  /*//////////////////////////////////////////////////////////////
               Test Permit Allowlist Shares
  //////////////////////////////////////////////////////////////*/
  describe("Permit Allowlist Shares", () => {
    before(async() => {
      domainName = await allowlistShares.name();
      contractAddress = allowlistShares.address;
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await allowlistShares.DOMAIN_SEPARATOR())
        .to.equal(ethers.utils._TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowance of allowlist shares via permit", async() => {
      // sign permit with sig2
      const nonce = await allowlistShares.connect(sig2).nonces(sig2.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 432;
      const spender = sig1.address;
      const permitOwner = sig2.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await sig2._signTypedData(domain, permitType, permitValue));
      // execute permit with sig1
      expect(await allowlistShares.allowance(permitOwner, spender)).to.be.eq(0)
      await allowlistShares.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.constants.MaxUint256,
        v,
        r,
        s
        )
      // check allowance of sig2
      expect(await allowlistShares.allowance(permitOwner, spender)).to.be.eq(value)
    });
  })

  /*//////////////////////////////////////////////////////////////
               Test Permit Allowlist Draggable Shares
  //////////////////////////////////////////////////////////////*/
  describe("Permit Allowlist Draggable Shares", () => {
    before(async() => {
      domainName = await allowlistDraggable.name();
      contractAddress = allowlistDraggable.address;
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await allowlistDraggable.DOMAIN_SEPARATOR())
        .to.equal(ethers.utils._TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowance of allowlist draggable shares via permit", async() => {
      // sign permit with sig2
      const nonce = await allowlistDraggable.connect(sig2).nonces(sig2.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 432;
      const spender = sig1.address;
      const permitOwner = sig2.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await sig2._signTypedData(domain, permitType, permitValue));
      // execute permit with sig1
      expect(await allowlistDraggable.allowance(permitOwner, spender)).to.be.eq(0)
      await allowlistDraggable.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.constants.MaxUint256,
        v,
        r,
        s
        )
      // check allowance of sig2
      expect(await allowlistDraggable.allowance(permitOwner, spender)).to.be.eq(value)
    });
  })
});
