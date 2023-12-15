const { ethers} = require("hardhat");
const { expect } = require("chai");
const { setup, getBlockTimeStamp, randomBigInt } = require("./helper/index");
const { time }  = require("@nomicfoundation/hardhat-network-helpers");

// Shared  Config
const config = require("../scripts/deploy_config_optimism.js");

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

  let exFee;

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
  let chainId;
  let contractAddress;

  before(async() => {
    // deploy contracts and set up signers
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    oracle = owner;

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
    baseCurrency = await ethers.getContractAt("ERC20Named", config.baseCurrencyAddress);


    // coverage has a problem with deplyoing this contract via hardhat-deploy
    let recoveryHubAddress = await recoveryHub.getAddress();
    let offerFactoryAddress = await offerFactory.getAddress();
    let allowlistSharesAddress = await allowlistShares.getAddress();
    allowlistDraggable = await ethers.deployContract("AllowlistDraggableShares", [config.allowlist_terms, allowlistSharesAddress, config.quorumBps, config.quorumMigration, config.votePeriodSeconds, recoveryHubAddress, offerFactoryAddress, oracle.address, owner.address]);
    await allowlistDraggable.waitForDeployment();

    exFee = ethers.parseUnits("0.01", await baseCurrency.decimals());
    chainId = Number((await ethers.provider.getNetwork()).chainId);
  })

  /*//////////////////////////////////////////////////////////////
                    Test Permit Shares
  //////////////////////////////////////////////////////////////*/
  describe("Permit Shares", () => {
    before(async() => {
      contractAddress = await shares.getAddress();
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await shares.DOMAIN_SEPARATOR())
        .to.equal(ethers.TypedDataEncoder.hashDomain(domain));
    }) 

    it("Should revert when deadline is over", async() => {
      // get block timestamp
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const blockTimestamp = block.timestamp;
      // sign permit with sig2
      const nonce = await shares.connect(sig2).nonces(sig2.address);
      const deadline = BigInt(blockTimestamp);
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
      const { v, r, s } = ethers.Signature.from(await sig2.signTypedData(domain, permitType, permitValue));

      // advance time by 1 and mine new block
      //await time.increase(1);
      //console.log(deadline.toString());

      // execute permit with sig1
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(0)
      await expect(shares.connect(sig1).permit(permitOwner, spender, value, deadline, v, r, s))
        .to.be.revertedWithCustomError(shares, "Permit_DeadlineExpired")
        .withArgs(deadline, deadline + 1n); // hardhat automatically increses block.timestamp + 1 at each tx
      // check allowance of sig2
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(0)
    });  
  
    it("Should set allowance of shares via permit", async() => {
      // sign permit with sig2
      const nonce = await shares.connect(sig2).nonces(sig2.address);
      const deadline = ethers.MaxUint256;
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
      const { v, r, s } = ethers.Signature.from(await sig2.signTypedData(domain, permitType, permitValue));

      // execute permit with sig1
      expect(await shares.allowance(permitOwner, spender)).to.be.eq(0n)
      await shares.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.MaxUint256,
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
    beforeEach(async() => {
      contractAddress = await draggable.getAddress();
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await draggable.DOMAIN_SEPARATOR())
        .to.equal(ethers.TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowanceof draggable shares via permit", async() => {
      // sign permit with sig2
      const nonce = await draggable.connect(sig2).nonces(sig2.address);
      const deadline = ethers.MaxUint256;
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
      const { v, r, s } = ethers.Signature.from(await sig2.signTypedData(domain, permitType, permitValue));
      // execute permit with sig1
      expect(await draggable.allowance(permitOwner, spender)).to.be.eq(0n)
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
      const deadline = ethers.MaxUint256;
      const value = 200;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
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
  });

  /*//////////////////////////////////////////////////////////////
                Test Sell Draggable Shares via Permit
  //////////////////////////////////////////////////////////////*/
  describe("Sell shares with permit", () => {
    let relayer;
    let seller;
    let randomShareAmount;
    let baseAmount;
    beforeEach(async() => {
      contractAddress = await draggable.getAddress();
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
      const { trustedForwarder } = await getNamedAccounts();
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [trustedForwarder],
      });
      relayer = await ethers.getSigner(trustedForwarder);
      seller = sig3;
      randomShareAmount = randomBigInt(50, 500);
      baseAmount = await brokerbot.getSellPrice(randomShareAmount);
    })
    afterEach(async() => {
      const { trustedForwarder } = await getNamedAccounts();
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [trustedForwarder],
      });
    });

    it("Should revert sell shares with permit for crypto if not from trusted relayer", async () => {
      relayer = sig1;
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.MaxUint256;
      const value = randomShareAmount;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const permitInfo = {exFee, deadline, v, r, s}
      await expect(paymentHub.connect(relayer).sellSharesWithPermit(await brokerbot.getAddress(), await draggable.getAddress(), seller.address, seller.address, value, "0x01", permitInfo))
        .to.be.revertedWithCustomError(paymentHub, "PaymentHub_InvalidSender")
        .withArgs(relayer.address);
    });

    it("Should sell shares with permit for crypto via relayer", async () => {
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.MaxUint256;
      const value = randomShareAmount;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const sellPrice = await brokerbot.getSellPrice(value);
      const baseCurrencyBefore = await baseCurrency.balanceOf(seller.address);
      const sharesBefore = await draggable.balanceOf(seller.address);
      const permitInfo = {exFee, deadline, v, r, s};
      await paymentHub.connect(relayer).sellSharesWithPermit(await brokerbot.getAddress(), await draggable.getAddress(), seller.address, seller.address, value, "0x01", permitInfo);
      const baseCurrencyAfter = await baseCurrency.balanceOf(seller.address);
      const sharesAfter = await draggable.balanceOf(seller.address);
      expect(baseCurrencyAfter - baseCurrencyBefore).to.be.equal(sellPrice - exFee);
      expect(sharesBefore - value).to.be.equal(sharesAfter);
    });
    it("Should sell shares with permit for crypto via seller", async () => {
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.MaxUint256;
      const value = randomShareAmount;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const baseCurrencyBefore = await baseCurrency.balanceOf(seller.address);
      const sharesBefore = await draggable.balanceOf(seller.address);
      const permitInfo = {exFee: 0, deadline, v, r, s}
      await paymentHub.connect(relayer).sellSharesWithPermit(await brokerbot.getAddress(), await draggable.getAddress(), seller.address, seller.address, value, "0x01", permitInfo);
      const baseCurrencyAfter = await baseCurrency.balanceOf(seller.address);
      const sharesAfter = await draggable.balanceOf(seller.address);
      expect(baseCurrencyAfter - baseCurrencyBefore).to.be.equal(baseAmount);
      expect(sharesBefore - value).to.be.equal(sharesAfter);
    });

    it("Should sell shares with permit for fiat", async () => {
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.MaxUint256;
      const value = randomShareAmount;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const baseCurrencyBefore = await baseCurrency.balanceOf(seller.address);
      const sharesBefore = await draggable.balanceOf(seller.address);
      // fee should be 0 on sell for fiat
      const permitInfo = {exFee: 0, deadline, v, r, s}
      await paymentHub.connect(relayer).sellSharesWithPermit(await brokerbot.getAddress(), await draggable.getAddress(), seller.address, seller.address, value, "0x02", permitInfo);
      const baseCurrencyAfter = await baseCurrency.balanceOf(seller.address);
      const sharesAfter = await draggable.balanceOf(seller.address);
      expect(baseCurrencyBefore).to.be.equal(baseCurrencyAfter);
      expect(sharesBefore - value).to.be.equal(sharesAfter);
    });
    it("Should sell shares with permit for crypto and send it to off-ramp", async () => {
      const offRamp = sig4.address;
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.MaxUint256;
      const value = randomShareAmount;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
      // relayer calls sell via paymenthub
      const baseCurrencyBefore = await baseCurrency.balanceOf(offRamp);
      //console.log(`baseCurrencyBefore: ${baseCurrencyBefore}`);
      const sharesBefore = await draggable.balanceOf(seller.address);
      const permitInfo = {exFee, deadline, v, r, s}
      await paymentHub.connect(relayer).sellSharesWithPermit(await brokerbot.getAddress(), await draggable.getAddress(), seller.address, offRamp, value, "0x01", permitInfo);
      const baseCurrencyAfter = await baseCurrency.balanceOf(offRamp);
      //console.log(`baseCurrencyAfter: ${baseCurrencyAfter}`);
      const sharesAfter = await draggable.balanceOf(seller.address);
      expect(baseCurrencyAfter - baseCurrencyBefore).to.be.equal(baseAmount - exFee);
      expect(sharesBefore - value).to.be.equal(sharesAfter);
    })

    it("Should sell against ETH with Permit from Seller", async () => {
      // appove base currency in payment hub
      await paymentHub.approveERC20(config.baseCurrencyAddress);
      const wethContract = await ethers.getContractAt("ERC20Named", config.wethAddress);
      // path: XCHF -> WETH
      const types = ["address","uint24","address","uint24","address"];
      const values = [config.baseCurrencyAddress, 500, config.daiAddress, 3000, config.wethAddress];
      path = ethers.solidityPacked(types,values);
      const nonce = await draggable.connect(seller).nonces(seller.address);
      const deadline = ethers.MaxUint256;
      const value = randomShareAmount;
      const spender = await paymentHub.getAddress();
      const permitOwner = seller.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await seller.signTypedData(domain, permitType, permitValue));
      const ethBalanceSellerBefore = await ethers.provider.getBalance(seller.address);
      // in real use case slippage should be considerered for ethAmount (the miniminum out amount from the swap)
      ethAmount = await paymentHub.getPriceERC20.staticCall(baseAmount, path, false);
      const params = {
        path: path,
        recipient: seller.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountIn: baseAmount,
        amountOutMinimum: ethAmount
      };
      const permitInfo = {exFee: 0, deadline, v, r, s}
      await paymentHub.connect(relayer).sellSharesWithPermitAndSwap(await brokerbot.getAddress(), await draggable.getAddress(), seller.address, randomShareAmount, "0x01", permitInfo, params, true);
      const ethBalanceSellerAfter = await ethers.provider.getBalance(seller.address);
      expect(ethBalanceSellerAfter - ethBalanceSellerBefore).to.equal(ethAmount);
      expect(await wethContract.balanceOf(await paymentHub.getAddress())).to.equal(0);
      expect(await ethers.provider.getBalance(await paymentHub.getAddress())).to.equal(0);
    })

    /* xchf dosen't have permit
    it("Should buy shares with permit", async () => {
      const relayer = sig1;
      // sign permit with sig3
      const buyer = sig3;
      const nonce = await baseCurrency.nonces(buyer.address);
      const deadline = ethers.MaxUint256;
      const value = 200;
      const spender = await paymentHub.getAddress();
      const permitOwner = buyer.address;
      const permitValue =  {
        owner: permitOwner,
        spender,
        value,
        nonce,
        deadline,
      }
      const { v, r, s } = ethers.Signature.from(await buyer.signTypedData(domain, permitType, permitValue));
      // relayer calls buy via paymenthub
      const buyPrice = await brokerbot.getBuyPrice(value);
      const baseCurrencyBefore = await baseCurrency.balanceOf(buyer.address);
      const sharesBefore = await draggable.balanceOf(buyer.address);
      await paymentHub.connect(relayer).payAndNotifyWithPermit(buyer.address, await brokerbot.getAddress(), value, "0x", deadline, v, r, s);
      const baseCurrencyAfter = await baseCurrency.balanceOf(buyer.address);
      const sharesAfter = await draggable.balanceOf(buyer.address);
      expect(baseCurrencyBefore - buyPrice)).to.be.equal(baseCurrencyAfter);
      expect(sharesBefore + value)).to.be.equal(sharesAfter);
    });*/


  })

  /*//////////////////////////////////////////////////////////////
               Test Permit Allowlist Shares
  //////////////////////////////////////////////////////////////*/
  describe("Permit Allowlist Shares", () => {
    before(async() => {
      contractAddress = await allowlistShares.getAddress();
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await allowlistShares.DOMAIN_SEPARATOR())
        .to.equal(ethers.TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowance of allowlist shares via permit", async() => {
      // sign permit with sig2
      const nonce = await allowlistShares.connect(sig2).nonces(sig2.address);
      const deadline = ethers.MaxUint256;
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
      const { v, r, s } = ethers.Signature.from(await sig2.signTypedData(domain, permitType, permitValue));
      // execute permit with sig1
      expect(await allowlistShares.allowance(permitOwner, spender)).to.be.eq(0)
      await allowlistShares.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.MaxUint256,
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
      contractAddress = await allowlistDraggable.getAddress();
      domain = {
        chainId: chainId,
        verifyingContract: contractAddress,
      }
    })  
    it("domain separator returns properly", async () => {
      expect(await allowlistDraggable.DOMAIN_SEPARATOR())
        .to.equal(ethers.TypedDataEncoder.hashDomain(domain));
    })    
  
    it("Should set allowance of allowlist draggable shares via permit", async() => {
      // sign permit with sig2
      const nonce = await allowlistDraggable.connect(sig2).nonces(sig2.address);
      const deadline = ethers.MaxUint256;
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
      const { v, r, s } = ethers.Signature.from(await sig2.signTypedData(domain, permitType, permitValue));
      // execute permit with sig1
      expect(await allowlistDraggable.allowance(permitOwner, spender)).to.be.eq(0)
      await allowlistDraggable.connect(sig1).permit(
        permitOwner, 
        spender,
        value,
        ethers.MaxUint256,
        v,
        r,
        s
        )
      // check allowance of sig2
      expect(await allowlistDraggable.allowance(permitOwner, spender)).to.be.eq(value)
    });
  })
});
