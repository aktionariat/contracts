const { ethers} = require("hardhat");
const { expect } = require("chai");
const { setup } = require("./helper/index");
const { time }  = require("@nomicfoundation/hardhat-network-helpers");

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Permit", () => {
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

  const fee = "100000000000000000";

  before(async() => {
    // deploy contracts and set up signers
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    oracle = owner;

    // deploy contracts
    /*await deployments.fixture([
      "ReoveryHub",
      "OfferFactory",
      "PaymentHub",
      "Shares",
      "DraggableShares",
      "AllowlistShares",
      "Brokerbot"
    ]);*/

    // deploy contracts
    await setup();

    // get references
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    allowlistShares = await ethers.getContract("AllowlistShares");
    paymentHub = await ethers.getContract("PaymentHub");
    brokerbot = await ethers.getContract("Brokerbot");
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);


    // coverage has a problem with deplyoing this contract via hardhat-deploy
    allowlistDraggable = await ethers.getContractFactory("AllowlistDraggableShares")
      .then(factory => factory.deploy(config.allowlist_terms, allowlistShares.address, config.quorumBps, config.quorumMigration, config.votePeriodSeconds, recoveryHub.address, offerFactory.address, oracle.address, owner.address))
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

    it("Should revert when deadline is over", async() => {
      // get block timestamp
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const blockTimestamp = block.timestamp;
      // sign permit with sig2
      const nonce = await shares.connect(sig2).nonces(sig2.address);
      const deadline = ethers.BigNumber.from(blockTimestamp);
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

      // advance time by 1 and mine new block
      //await time.increase(1);
      //console.log(deadline.toString());

      // execute permit with sig1
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(0)
      await expect(shares.connect(sig1).permit(permitOwner, spender, value, deadline, v, r, s))
        .to.be.revertedWithCustomError(shares, "Permit_DeadlineExpired")
        .withArgs(deadline, deadline.add(1)); // hardhat automatically increses block.timestamp + 1 at each tx
      // check allowance of sig2
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(0)
    });  
  
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
        deadline,
        v,
        r,
        s
        )
      // check allowance of sig2
      expect(await draggable.allowance(permitOwner, spender)).to.be.eq(value)
    });

    it("Should revert if wrong spender uses permit/signature", async () => {
      // sign permit with sig4
      const seller = sig4;
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 200;
      const spender = paymentHub.address;
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await seller._signTypedData(domain, permitType, permitValue));
      // call permit with wrong params
      await expect(draggable.connect(sig1).permit(
       permitOwner, 
       sig1.address,
       value,
       deadline,
       v,
       r,
       s
       )).to.be.revertedWithCustomError(draggable, "Permit_InvalidSigner");
   });

   it("Should revert sell shares with permit for crypto if not from trusted relayer", async () => {
    const relayer = sig1;
    // sign permit with sig3
    const seller = sig3;
    const nonce = await draggable.connect(seller).nonces(seller.address);
    const deadline = ethers.constants.MaxUint256;
    const value = 200;
    const spender = paymentHub.address;
    const permitOwner = seller.address;
    const permitValue =  {
      owner: permitOwner,
      spender,
      value,
      nonce,
      deadline,
    }
    const { v, r, s } = ethers.utils.splitSignature(await seller._signTypedData(domain, permitType, permitValue));
    // relayer calls sell via paymenthub
    await expect(paymentHub.connect(relayer).sellSharesWithPermit(brokerbot.address, seller.address, value, fee, deadline, "0x01", v, r, s))
      .to.be.revertedWithCustomError(paymentHub, "PaymentHub_NonTrustedForwader")
      .withArgs(relayer.address);
  });

    it("Should sell shares with permit for crypto", async () => {
      const relayer = deployer;
      // sign permit with sig3
      const seller = sig3;
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 200;
      const spender = paymentHub.address;
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await seller._signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const sellPrice = await brokerbot.getSellPrice(value);
      const baseCurrencyBefore = await baseCurrency.balanceOf(seller.address);
      const sharesBefore = await draggable.balanceOf(seller.address);
      await paymentHub.connect(relayer).sellSharesWithPermit(brokerbot.address, seller.address, value, fee, deadline, "0x01", v, r, s);
      const baseCurrencyAfter = await baseCurrency.balanceOf(seller.address);
      const sharesAfter = await draggable.balanceOf(seller.address);
      expect(baseCurrencyBefore.add(sellPrice).sub(fee)).to.be.equal(baseCurrencyAfter);
      expect(sharesBefore.sub(value)).to.be.equal(sharesAfter);
    });

    it("Should sell shares with permit for fiat", async () => {
      const relayer = deployer;
      // sign permit with sig3
      const seller = sig3;
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 200;
      const spender = paymentHub.address;
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await seller._signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const sellPrice = await brokerbot.getSellPrice(value);
      const baseCurrencyBefore = await baseCurrency.balanceOf(seller.address);
      const sharesBefore = await draggable.balanceOf(seller.address);
      // fee should be 0 on sell for fiat
      await paymentHub.connect(relayer).sellSharesWithPermit(brokerbot.address, seller.address, value, 0, deadline, "0x02", v, r, s);
      const baseCurrencyAfter = await baseCurrency.balanceOf(seller.address);
      const sharesAfter = await draggable.balanceOf(seller.address);
      expect(baseCurrencyBefore).to.be.equal(baseCurrencyAfter);
      expect(sharesBefore.sub(value)).to.be.equal(sharesAfter);
    });

    /* xchf dosen't have permit
    it("Should buy shares with permit", async () => {
      const relayer = sig1;
      // sign permit with sig3
      const buyer = sig3;
      const nonce = await baseCurrency.nonces(buyer.address);
      const deadline = ethers.constants.MaxUint256;
      const value = 200;
      const spender = paymentHub.address;
      const permitOwner = buyer.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.utils.splitSignature(await buyer._signTypedData(domain, permitType, permitValue));
      // relayer calls buy via paymenthub
      const buyPrice = await brokerbot.getBuyPrice(value);
      const baseCurrencyBefore = await baseCurrency.balanceOf(buyer.address);
      const sharesBefore = await draggable.balanceOf(buyer.address);
      await paymentHub.connect(relayer).payAndNotifyWithPermit(buyer.address, brokerbot.address, value, "0x", deadline, v, r, s);
      const baseCurrencyAfter = await baseCurrency.balanceOf(buyer.address);
      const sharesAfter = await draggable.balanceOf(buyer.address);
      expect(baseCurrencyBefore.sub(buyPrice)).to.be.equal(baseCurrencyAfter);
      expect(sharesBefore.add(value)).to.be.equal(sharesAfter);
    });*/


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
