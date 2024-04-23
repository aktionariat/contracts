const {network, ethers, getNamedAccounts} = require("hardhat");
const Chance = require("chance");
const { setBalance, setBalanceWithAmount, randomBigInt } = require("./helper/index");
const { expect } = require("chai");
const { PANIC_CODES } = require("@nomicfoundation/hardhat-chai-matchers/panic");

// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);

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
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);

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
    permit2Hub = await ethers.getContract("Permit2Hub");

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
    allowlistDraggable = await ethers.deployContract("AllowlistDraggableShares", [config.allowlist_terms, draggableParams, recoveryHubAddress, offerFactoryAddress, oracle.address, permit2Hub.getAddress()]);
    await allowlistDraggable.waitForDeployment();

    
    // Mint baseCurrency Tokens to first 5 accounts
    await setBalance(baseCurrency, config.baseCurrencyBalanceSlot, accounts);

    //Mint shares to accounts
    for( let i = 0; i < accounts.length; i++) {
      await shares.connect(owner).mint(accounts[i], 1000000);
    }

     // Convert some Shares to DraggableShares
    for (let i = 0; i < accounts.length; i++) {
      await shares.connect(signers[i]).approve(await draggable.getAddress(), config.infiniteAllowance);
      await draggable.connect(signers[i]).wrap(accounts[i], 900000);
    }

  });

  describe("Deployment", () => {
    describe("Shares", () => {
      it("Should deploy shares", async () => {
        expect(await shares.getAddress()).to.exist;
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

      it("Should give back newest version", async () => {
        expect(await shares.VERSION()).to.equal(4);
      });
    });

    describe("Draggable Shares", () => {
      it("Should deploy contracts", async () => {
        expect(await draggable.getAddress()).to.exist;
      });
  
      it("Should have params specified at the constructor", async() => {
        expect(await draggable.terms()).to.equal(config.terms);
        expect(await draggable.name()).to.equal(config.name + " SHA");
      }); 

      it("Should get right claim deleter", async () => {
        expect(await draggable.getClaimDeleter()).to.equal(oracle.address);
      });

      it("Should give back newest version", async () => {
        expect(await draggable.VERSION()).to.equal(3);
      });
    });

    describe("AllowlistShares", () => {
      it("Should deploy allowlist shares", async () => {
        expect(await allowlistShares.getAddress()).to.exist;
      });

      it("Should have params specified at the constructor", async() => {
        expect(await allowlistShares.name()).to.equal(config.allowlist_name);
        expect(await allowlistShares.symbol()).to.equal(config.allowlist_symbol);
        expect(await allowlistShares.terms()).to.equal(config.allowlist_terms);
      }); 
    });

    describe("Allowlist Draggable Shares", () => {
      it("Should deploy contracts", async () => {
        expect(await allowlistDraggable.getAddress()).to.exist;
      });

      it("Should have params specified at the constructor", async() => {
        expect(await allowlistDraggable.terms()).to.equal(config.allowlist_terms);
      }); 
    });
  });

  describe("Setup", () => {
    it("should have some ETH in first 5 accounts", async () => {  
      for (let i = 0; i < 5; i++) {
        const balance = await ethers.provider.getBalance(accounts[i]);
        expect(balance).to.be.greaterThan(0n);
      }
    });

    it("should have some BaseCurrency in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await baseCurrency.balanceOf(accounts[i]);
        expect(balance).is.greaterThan(0n);
      }
    });

    it("should have some Shares in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await shares.balanceOf(accounts[i]);
        expect(balance).is.greaterThan(0n);
      }
    });

    it("should have some DraggableShares in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await draggable.balanceOf(accounts[i]);
        expect(balance).is.greaterThan(0n);
      }
    });
  });

  describe("Shares", () => {

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
    });

    it("Should set new total shares", async () => {
      const randomChange = randomBigInt(1, 50000);
      const totalSupply = await shares.totalValidSupply();
      let newTotalShares = await totalSupply + randomChange;

      // should revert if new total shares is < than valid supply
      await expect(shares.connect(owner).setTotalShares(totalSupply - randomChange))
        .to.be.revertedWithCustomError(shares, "Shares_InvalidTotalShares")
        .withArgs(totalSupply, totalSupply - randomChange);

      let totalShares = await shares.totalShares();
      newTotalShares = totalShares + randomChange;

      // set correct new total and check if set correct
      await shares.connect(owner).setTotalShares(newTotalShares);
      totalShares = await shares.totalShares();
      expect(totalShares).to.equal(newTotalShares);
    });

    it("Should declare tokens invalid", async () => {
      const randomdAmount = randomBigInt(1, 50000);
      const invalidTokenBefore = await shares.invalidTokens();
      const holderBalance = await shares.balanceOf(sig4.address);

      // try to declare too many tokens invalid
      await expect(shares.connect(owner).declareInvalid(sig4.address, holderBalance + 1n, "more than I have"))
        .to.be.revertedWithCustomError(shares, "ERC20InsufficientBalance")
        .withArgs(sig4.address, holderBalance, holderBalance + 1n);

      await expect(shares.connect(owner).declareInvalid(sig4.address, randomdAmount, "test"))
        .to.emit(shares, "TokensDeclaredInvalid")
        .withArgs(sig4.address, randomdAmount, "test");

      const invalidTokenAfter = await shares.invalidTokens();
      expect(invalidTokenBefore + randomdAmount).to.equal(invalidTokenAfter);
    });

    it("Should burn shares", async () => {
      const randomAmountToBurn = randomBigInt(1, 5000);
      const balanceBefore = await shares.balanceOf(sig3.address);
      await shares.connect(sig3).burn(randomAmountToBurn);
      const balanceAfter = await shares.balanceOf(sig3.address);
      expect(balanceBefore - randomAmountToBurn).to.equal(balanceAfter);
    });

    it("Should revert when trying to mint more shares than total shares", async () => {
      const totalShares = await shares.totalShares();
      const totalValidSupply = await shares.totalValidSupply();
      const amountToMint = totalShares - totalValidSupply + 1n;
      await expect(shares.connect(owner).mint(sig1.address, amountToMint))
        .to.be.revertedWithCustomError(shares, "Shares_InsufficientTotalShares")
        .withArgs(totalShares, totalValidSupply + amountToMint);
    })

    it("Should revert with overflow when trying to mint more than uint256 shares", async () => {
      const totalValidSupply = await shares.totalValidSupply();
      const amountToMint = ethers.MaxUint256 - totalValidSupply + 1n;
      await expect(shares.connect(owner).mint(sig1.address, amountToMint))
        .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
    })

    it("Should mint and call on shares", async () => {
      const randomAmountToMint = randomBigInt(1, 5000);
      const totalShares = await shares.totalShares();

      //set new total shares as we mint more
      await shares.connect(owner).setTotalShares(totalShares + randomAmountToMint);
      const balanceBefore = await draggable.balanceOf(sig2.address);
      // mint shares and wrap them in draggable
      await shares.connect(owner).mintAndCall(sig2.address, await draggable.getAddress(), randomAmountToMint, "0x01");
      const balanceAfter = await draggable.balanceOf(sig2.address);

      expect(balanceBefore + randomAmountToMint).to.equal(balanceAfter);
    });

    it("Should revert if mintMany(AndCall) is called with unequal array lengths", async () => {
      const randomAmountToMint = randomBigInt(1, 5000);
      const randomAmountToMint2 = randomBigInt(1, 5000);
      await expect(shares.connect(owner).mintMany([sig2.address], [randomAmountToMint, randomAmountToMint2]))
        .to.be.revertedWithCustomError(shares, "Shares_UnequalLength")
        .withArgs(1, 2);
      await expect(shares.connect(owner).mintManyAndCall([sig2.address], await draggable.getAddress(), [randomAmountToMint, randomAmountToMint], "0x01"))
        .to.be.revertedWithCustomError(shares, "Shares_UnequalLength")
        .withArgs(1, 2);
    })

    it("Should mint and call on shares for multiple addresses", async() => {
      const randomAmountToMint = randomBigInt(1, 5000);
      const totalShares = await shares.totalShares();

      //set new total shares as we mint more
      await shares.connect(owner).setTotalShares(totalShares + randomAmountToMint*2n);
      const balance2Before = await draggable.balanceOf(sig2.address);
      const balance3Before = await draggable.balanceOf(sig3.address);
      // mint shares and wrap them in draggable
      await shares.connect(owner).mintManyAndCall([sig2.address, sig3.address], await draggable.getAddress(), [randomAmountToMint, randomAmountToMint], "0x01");
      const balance2After = await draggable.balanceOf(sig2.address);
      const balance3After = await draggable.balanceOf(sig3.address);

      expect(balance2Before + randomAmountToMint).to.equal(balance2After);
      expect(balance3Before + randomAmountToMint).to.equal(balance3After);
    });

    it("Should mint shares to multiple addresses", async() => {
      const randomAmountToMint = randomBigInt(1, 5000);
      const randomAmountToMint2 = randomBigInt(1, 5000);
      const totalShares = await shares.totalShares();

      //set new total shares as we mint more
      await shares.connect(owner).setTotalShares(totalShares + randomAmountToMint+randomAmountToMint2);
      const balance2Before = await shares.balanceOf(sig2.address);
      const balance3Before = await shares.balanceOf(sig3.address);
      // mint shares
      await shares.connect(owner).mintMany([sig2.address, sig3.address], [randomAmountToMint, randomAmountToMint2]);
      const balance2After = await shares.balanceOf(sig2.address);
      const balance3After = await shares.balanceOf(sig3.address);

      expect(balance2Before + randomAmountToMint).to.equal(balance2After);
      expect(balance3Before + randomAmountToMint2).to.equal(balance3After);
    });

    it("Should wrap some more shares with transferAndCall", async () => {
      const randomAmountToWrap = randomBigInt(1, 5000);
      const balanceBefore = await draggable.balanceOf(sig1.address);
      await shares.connect(sig1).transferAndCall(await draggable.getAddress(), randomAmountToWrap, "0x01");
      const balanceAfter = await draggable.balanceOf(sig1.address);
      expect(balanceBefore + randomAmountToWrap).to.equal(balanceAfter);
    })

    it("Should allow transfer ownership", async () => {
      await expect(shares.connect(owner).transferOwnership(sig1.address))
        .to.emit(shares, "OwnershipTransferred")
        .withArgs(owner.address, sig1.address);
      expect(await shares.owner()).to.equal(sig1.address);
      await shares.connect(sig1).transferOwnership(owner.address)
    });
  });

  describe("Draggable Shares", () => {
    it("Should set new oracle", async () => {
      const newOracle = sig1.address;
      // revert if not oracle 
      await expect(draggable.connect(sig1).setOracle(newOracle))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig1.address);
      await draggable.connect(oracle).setOracle(newOracle);
      expect(await draggable.oracle()).to.equal(newOracle);
      // reset oracle for offer testing
      await expect(draggable.connect(sig1).setOracle(owner.address))
        .to.emit(draggable, 'ChangeOracle')
        .withArgs(owner.address);
    });

    it("Should burn draggable shares", async () => {
      const randomAmountToBurn = randomBigInt(1, 5000);
      const balanceBefore = await shares.balanceOf(await draggable.getAddress());
      const balanceBeforeDraggable = await draggable.balanceOf(sig3.address);
      const totalSupplyBefore = await shares.totalSupply();

      // burn token which burns also shares which are in the drraggable contract
      // and reduces supply from shares
      await draggable.connect(sig3).burn(randomAmountToBurn);
      const balanceAfter = await shares.balanceOf(await draggable.getAddress());
      const balanceAfterDraggable = await draggable.balanceOf(sig3.address);
      const totalSupplyAfter= await shares.totalSupply();
      expect(balanceBeforeDraggable - randomAmountToBurn).to.equal(balanceAfterDraggable);
      expect(balanceBefore - randomAmountToBurn).to.equal(balanceAfter);
      expect(totalSupplyBefore - randomAmountToBurn).to.equal(totalSupplyAfter);
    });

    it("Should revert wrapping(mint) w/o shares", async () => {
      const amount = 100
      // wrap from address without token
      await expect(draggable.connect(deployer).wrap(deployer.address, amount))
        .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW); // should throw underflow panic error
      // info: correct wrapping is done in the first before starting loc 44
    });

    it("Should revert on unwrap", async () => {
      await expect(draggable.connect(sig2).unwrap(10))
        .to.be.revertedWithCustomError(draggable, "Draggable_IsBinding");
    });

    it("Should revert when onTokenTransfer isn't called from wrapped token (prevent minting)", async () => {
      await expect(draggable.connect(sig2).onTokenTransfer(sig1.address, 100, "0x01"))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig2.address);
    })

    it("Should revert if drag isn't called from offer contract", async () => {
      await expect(draggable.connect(sig2).drag(sig2.address, config.baseCurrencyAddress))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig2.address);
    })
    it("Should revert if notifyOfferEnded isn't called from offer contract", async () => {
      await expect(draggable.connect(sig2).notifyOfferEnded())
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig2.address);
    })
    it("Should revert if notifyVoted isn't called from offer contract", async () => {
      await expect(draggable.connect(sig2).notifyVoted(sig2.address))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig2.address);
    })

    it("Should revert on overflow", async () => {
      // first set total shares > uint224
      await shares.connect(owner).setTotalShares("0x00000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      const largeNumber = "0x00000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      const balanceBefore = await shares.balanceOf(sig1.address);
      await expect(shares.connect(owner).mint(sig1.address, largeNumber))
        .to.be.revertedWithCustomError(shares, "ERC20BalanceOverflow")
        .withArgs(sig1.address, balanceBefore, largeNumber);
      // set total shares back 
      await shares.connect(owner).setTotalShares(config.totalShares);
    })

    it("Should revert on underflow", async () => {
      // first set a flag e.g. claim
      await draggable.connect(sig2).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      await recoveryHub.connect(sig2).declareLost(await draggable.getAddress(), await draggable.getAddress(), sig4.address);
      
      await expect(draggable.connect(sig4).transfer(sig2.address, "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"))
        .to.be.revertedWithCustomError(draggable, "ERC20InsufficientBalance")
        .withArgs(sig4.address, await draggable.balanceOf(sig4.address), "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      await draggable.connect(oracle).deleteClaim(sig4.address);
    })

    it("Should revert when transfer or mint to 0x0 address", async () => {
      await expect(shares.connect(owner).transfer(ethers.ZeroAddress, 1))
        .to.be.revertedWithCustomError(shares, "ERC20InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
      await expect(shares.connect(owner).mint(ethers.ZeroAddress, 1))
        .to.be.revertedWithCustomError(shares, "ERC20InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
      await expect(draggable.connect(owner).transfer(ethers.ZeroAddress, 1))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
    })

    it("Should set new terms for draggable", async () => {
      const oldTerms = "test.ch/terms";
      const newTerms = "investor.test.ch";
      expect(await draggable.terms()).to.equal(oldTerms)
      await expect(draggable.connect(sig1).setTerms("test")).to.be.revertedWithCustomError(draggable, "ERC20InvalidSender");
      await expect(draggable.connect(owner).setTerms(newTerms)).to.emit(draggable, 'ChangeTerms').withArgs(newTerms);
      expect(await draggable.terms()).to.equal(newTerms);
    })
  });

  describe("Recovery", () => {
    const collateralAddress = config.baseCurrencyAddress;
    const collateralRate = 10;
    it("Should able to disable recovery", async () => {
      const recovery = await ethers.getContractAt("RecoveryHub", await draggable.recovery());
      await recovery.connect(sig1).setRecoverable(false);
      expect(await recoveryHub.isRecoverable(sig1.address)).to.equal(false);
    });

    it("Should revert declare lost on disabled recovery", async () => {
      await expect(recoveryHub.connect(sig2).declareLost(await draggable.getAddress(), await draggable.getAddress(), sig1.address))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_RecoveryDisabled")
        .withArgs(sig1.address);
    });

    it("Should revert declare lost with bad collateral", async () => {
      await expect(recoveryHub.connect(sig1).declareLost(await draggable.getAddress(), config.wbtcAddress, sig4.address))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_BadCollateral")
        .withArgs(config.wbtcAddress);
    })

    it("Should revert declare lost on empty address", async () => {
      await expect(recoveryHub.connect(sig1).declareLost(await draggable.getAddress(), await draggable.getAddress(), deployer.address))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_NothingToRecover")
        .withArgs(await draggable.getAddress(), deployer.address);
    })

    it("Should revert declare lost if there was no allowance set to recoveryhub", async () => {
      await expect(recoveryHub.connect(deployer).declareLost(await draggable.getAddress(), await draggable.getAddress(), sig4.address))
        .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW); // underflow on transfeFrom because allowance 0
    })

    it("Should revert declare lost if claimer hasn't enough collateral", async () => {
      await draggable.connect(deployer).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      await expect(recoveryHub.connect(deployer).declareLost(await draggable.getAddress(), await draggable.getAddress(), sig4.address))
        .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW); // underflow on transfeFrom because balance 0
    })

    it("Should set custom claim collateral for shares", async () => {
      // check for custom collateral address("0x0000000000000000000000000000000000000000")
      await shares.connect(owner).setCustomClaimCollateral(ethers.getAddress("0x0000000000000000000000000000000000000000"), 100);
      expect(await shares.getCollateralRate(ethers.getAddress("0x0000000000000000000000000000000000000000"))).to.equal(0);

      // test that collateralRate is not 0
      await expect(shares.connect(owner).setCustomClaimCollateral(collateralAddress, 0))
        .to.be.revertedWithCustomError(shares, "Recoverable_RateZero");
      // test that only owner can set
      await expect(shares.connect(sig1).setCustomClaimCollateral(collateralAddress, collateralRate))
        .to.be.revertedWithCustomError(shares, "Ownable_NotOwner")
        .withArgs(sig1.address);
      // test with owner
      await shares.connect(owner).setCustomClaimCollateral(collateralAddress, collateralRate);
      expect(await shares.customCollateralAddress()).to.equal(collateralAddress);
      expect(await shares.customCollateralRate()).to.equal(collateralRate);
      expect(await shares.getCollateralRate(await shares.getAddress())).to.equal(1);
      expect(await shares.getCollateralRate(collateralAddress)).to.equal(collateralRate);
      expect(await shares.getCollateralRate(await draggable.getAddress())).to.equal(0);
    });

    it("Draggable should get conversion factors from shares", async () => {
      expect(await draggable.getCollateralRate(ethers.getAddress("0x0000000000000000000000000000000000000000"))).to.equal(0);
      expect(await draggable.getCollateralRate(await draggable.getAddress())).to.equal(1);
      expect(await draggable.getCollateralRate(await shares.getAddress())).to.equal(1);
      expect(await draggable.getCollateralRate(collateralAddress)).to.equal(collateralRate);
    });

    it("Should revert if notifyClaimMade isn't called from RecoveryHub", async () => {
      await expect(draggable.connect(sig1).notifyClaimMade(sig1.address))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig1.address);
    })

    it("Should revert if notifyClaimDeleted isn't called from RecoveryHub", async () => {
      await expect(draggable.connect(sig1).notifyClaimDeleted(sig1.address))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig1.address);
    })

    it("Should revert if recover isn't called from RecoveryHub", async () => {
      await expect(draggable.connect(sig1).recover(sig2.address, sig1.address))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig1.address);
    })

    it("Should delete claim", async () => {
      await draggable.connect(sig5).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      const claimAdress = sig5.address;
      const lostAddress = sig4.address;
      const lostSigner = sig4;
      const lostAddressBalance = await draggable.balanceOf(lostAddress);
      const balanceClaimer = await draggable.balanceOf(claimAdress);

      // delete without claim should revert
      await expect(recoveryHub.deleteClaim(lostAddress))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_ClaimNotFound");

      // declare token lost
      const tx = await recoveryHub.connect(sig5).declareLost(await draggable.getAddress(), await draggable.getAddress(), lostAddress);
      // get claimant
      expect(await recoveryHub.getClaimant(await draggable.getAddress(), lostAddress)).to.be.equal(claimAdress);
      // get collataral
      const collateralRate = await draggable.getCollateralRate(await draggable.getAddress());
      expect(await recoveryHub.getCollateral(await draggable.getAddress(), lostAddress)).to.be.equal(lostAddressBalance * collateralRate);
      // get collateral type
      expect(await recoveryHub.getCollateralType(await draggable.getAddress(), lostAddress)).to.be.equal(await draggable.getAddress());
      // get timestamp
      const blockNum = await ethers.provider.getBlockNumber();
      const block= await ethers.provider.getBlock(blockNum);
      expect(await recoveryHub.getTimeStamp(await draggable.getAddress(), lostAddress)).to.be.equal(block.timestamp);
      
      // delete claim as non oracle
      await expect(draggable.connect(sig4).deleteClaim(lostAddress))
        .to.be.revertedWithCustomError(draggable, "ERC20InvalidSender")
        .withArgs(sig4.address);
      // delete claim as oracle
      await draggable.connect(oracle).deleteClaim(lostAddress);
      expect(await draggable.balanceOf(claimAdress)).to.equal(balanceClaimer);
    })

    it("Should remove claim when token are transfered", async () => {
      await draggable.connect(sig5).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      const lostAddress = sig4.address;
      const lostSigner = sig4;
      const lostAddressBalance = await draggable.balanceOf(lostAddress);

      // declare token lost
      await recoveryHub.connect(sig5).declareLost(await draggable.getAddress(), await draggable.getAddress(), lostAddress);
      // declare on same addresse should revert
      await expect(recoveryHub.connect(sig1).declareLost(await draggable.getAddress(), await draggable.getAddress(), lostAddress))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_AlreadyClaimed")
        .withArgs(await draggable.getAddress(), lostAddress);
      // check if flag is set
      expect(await draggable.hasFlag(lostAddress, 10)).to.be.true;
      // transfer to lost address
      await draggable.connect(owner).transfer(lostAddress, "10");
      // after transfer to lost address still claim on it
      expect(await draggable.hasFlag(lostAddress, 10)).to.be.true;
      // transfer from last address (to clear claim)
      await draggable.connect(lostSigner).transfer(sig5.address, "10");
      // claim cleared
      expect(await draggable.hasFlag(lostAddress, 10)).to.be.false;
      // get collateral
      expect(await draggable.balanceOf(lostAddress)).to.equal(await lostAddressBalance * 2n)

      // move funds back to sig5
      await draggable.connect(sig4).transfer(sig5.address, lostAddressBalance);
    });
    
    it("Should remove claim when lost address calls clearClaimFromUser", async () => {
      await draggable.connect(sig5).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      const lostAddress = sig4.address;
      const lostSigner = sig4;
      const lostAddressBalance = await draggable.balanceOf(lostAddress);

      // declare token lost
      await recoveryHub.connect(sig5).declareLost(await draggable.getAddress(), await draggable.getAddress(), lostAddress);
      // check if flag is set
      expect(await draggable.hasFlag(lostAddress, 10)).to.equal(true);
      // clear claim
      await recoveryHub.connect(lostSigner).clearClaimFromUser(await draggable.getAddress());
      // claim cleared
      expect(await draggable.hasFlag(lostAddress, 10)).to.equal(false);
      // get collateral
      expect(await draggable.balanceOf(lostAddress)).to.equal(await lostAddressBalance * 2n)
    });

    it("Should revert recover if there is no claim", async () => {
      await expect(recoveryHub.connect(sig1).recover(await draggable.getAddress(), deployer.address))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_ClaimNotFound")
        .withArgs(deployer.address);
    })

    it("Should able to recover token", async () => {
      const claimer = sig2;
      const lostAddress = sig3.address;
      await draggable.connect(claimer).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      const amountLost = await draggable.balanceOf(lostAddress);
      const amountClaimer = await draggable.balanceOf(claimer.address);
      // sig2 declares lost funds at sig3
      await recoveryHub.connect(claimer).declareLost(await draggable.getAddress(), await draggable.getAddress(), lostAddress);

      // check if flag is set
      // FLAG_CLAIM_PRESENT = 10
      expect(await draggable.hasFlag(lostAddress, 10)).to.equal(true);

      // revert if not the claimer tries to recover
      await expect(recoveryHub.connect(sig4).recover(await draggable.getAddress(), lostAddress))
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_InvalidSender")
        .withArgs(sig4.address);

      // revert if to early
      const claim = await recoveryHub.claims(await draggable.getAddress(), lostAddress);
      const claimPeriod = await draggable.claimPeriod();
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const blockTimestamp = BigInt(block.timestamp);
      await expect(recoveryHub.connect(claimer).recover(await draggable.getAddress(), lostAddress))
        //.to.be.revertedWith("too early");
        .to.be.revertedWithCustomError(recoveryHub, "RecoveryHub_InClaimPeriod")
        .withArgs(claim.timestamp + claimPeriod, blockTimestamp + 1n);

      // add claim period (180 days)
      await ethers.provider.send("evm_increaseTime", [Number(claimPeriod)]);
      await ethers.provider.send("evm_mine");

      // recover tokens
      await recoveryHub.connect(sig2).recover(await draggable.getAddress(), sig3.address);
      expect(await draggable.balanceOf(sig2.address)).to.equal(await amountLost + amountClaimer);
    });
  });

  describe("Allowlist", () => {
    // sig1 will be powerlist
    // sig2 will be forbidden
    // sig3 will be allowlist -> default
    // sig4 will be allowlist
    // sig5 will be default
    it("Should set forbidden and revert mint", async () => {
      //use sig2 for blacklist
      const forbiddenAddress = sig2.address;

      // mint to non type set works
      await allowlistShares.connect(owner).mint(forbiddenAddress, "1");

      //set type forbidden
      await allowlistShares.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      expect(await allowlistShares.canReceiveFromAnyone(forbiddenAddress)).to.be.false;
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.be.true;

      // after setting forbidden reverts
      await expect(allowlistShares.connect(owner).mint(forbiddenAddress, "1000"))
        .to.be.revertedWithCustomError(allowlistShares, "Allowlist_ReceiverIsForbidden")
        .withArgs(forbiddenAddress);
      const balanceForbidden = await allowlistShares.balanceOf(forbiddenAddress);
      expect(balanceForbidden).to.equal(1n);

      // forbidden can't transfer (sig2.address = forbidden)
      await expect(allowlistShares.connect(sig2).transfer(sig1.address, "1"))
        .to.be.revertedWithCustomError(allowlistShares, "Allowlist_SenderIsForbidden")
        .withArgs(sig2.address);
    });

    it("Should set allowlist for default address when minted from 0 (powerlisted)", async () => {
      //use sig3 for default address
      const defaultAddress = sig3.address
      // before mint is not allowlisted
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);

      await expect(allowlistShares.connect(owner).mint(defaultAddress, "1000"))
        .to.emit(allowlistShares, "AddressTypeUpdate")
        .withArgs(defaultAddress, TYPE_ALLOWLISTED);
      
      // after mint is allowlisted
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(true);      
      const balancedef = await allowlistShares.balanceOf(defaultAddress);
      expect(balancedef).to.equal(1000n);
    });

    it("Should set powerlist to not owner and transfer token to default", async () => {
      //set adr/sig1 as powerlist
      const powerlistAddress = sig1.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](powerlistAddress, TYPE_POWERLISTED);
      expect(await allowlistShares.isPowerlisted(powerlistAddress)).to.equal(true);

      // powerlist can't mint
      await expect(allowlistShares.connect(sig1).mint(powerlistAddress, "1000"))
        .to.be.revertedWithCustomError(allowlistShares, "Ownable_NotOwner")
        .withArgs(sig1.address);

      // mint to powerlist
      await await allowlistShares.connect(owner).mint(powerlistAddress, "1000");

      //use sig4 for default address
      const defaultAddress = sig4.address
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isPowerlisted(defaultAddress)).to.equal(false);

      // transfer from powerlist to default(sig4)
      const balanceBefore = await allowlistShares.balanceOf(defaultAddress);
      await allowlistShares.connect(sig1).transfer(defaultAddress, "100");
      const balanceAfter = await allowlistShares.balanceOf(defaultAddress);
      expect(balanceBefore + 100n).to.equal(balanceAfter);
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(true);
    });

    it("Should set allowlist address to default and transfer to default/allowlist, but not to forbidden address", async () => {
      // use sig3 for the default sender
      const defaultAddress = sig3.address
      // is still allowlisted
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(true);  
      // set to default and make shares transferable
      await allowlistShares.connect(owner)["setType(address,uint8)"](defaultAddress, TYPE_DEFAULT);
      // is not allowlisted anymore
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      
      // is not possible to send from default(sig3) to forbidden(sig2)
      const forbiddenAddress = sig2.address
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(true);
      await expect(allowlistShares.connect(sig3).transfer(forbiddenAddress, "100"))
        .to.be.revertedWithCustomError(allowlistShares, "Allowlist_ReceiverIsForbidden")
        .withArgs(forbiddenAddress);

      // is possible to send from default(sig3) to fresh/default(sig5)
      const freshAddress = sig5.address
      expect(await allowlistShares.isForbidden(freshAddress)).to.equal(false);
      expect(await allowlistShares.canReceiveFromAnyone(freshAddress)).to.equal(false);
      await allowlistShares.connect(sig3).transfer(freshAddress, "100");
      const balanceFresh = await allowlistShares.balanceOf(freshAddress);
      expect(balanceFresh).to.equal(100n);
      // fresh address is still default
      expect(await allowlistShares.isForbidden(freshAddress)).to.equal(false);
      expect(await allowlistShares.canReceiveFromAnyone(freshAddress)).to.equal(false);

      // is possible to send from default(sig3) to allowlist(sig4)
      const allowAddress = sig4.address;
      expect(await allowlistShares.isForbidden(allowAddress)).to.equal(false);
      expect(await allowlistShares.canReceiveFromAnyone(allowAddress)).to.equal(true);
      const balAllowBefore = await allowlistShares.balanceOf(allowAddress);
      await allowlistShares.connect(sig3).transfer(allowAddress, "100");
      const balAllowAfter = await allowlistShares.balanceOf(allowAddress);
      expect(balAllowBefore + 100n).to.equal(balAllowAfter);
    });

    it("Should not allow transfer from allowlist to default", async () => {
      // sig4 is allowlist address
      const allowAddress = sig4.address;
      expect(await allowlistShares.isForbidden(allowAddress)).to.equal(false);
      expect(await allowlistShares.canReceiveFromAnyone(allowAddress)).to.equal(true);

      // sig5 is default address
      const defaultAddress = sig5.address
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);

      // transfer from allowlist(sig4) to default(sig5) should fail
      await expect(allowlistShares.connect(sig4).transfer(defaultAddress, "100"))
        .to.be.revertedWithCustomError(allowlistShares, "Allowlist_ReceiverNotAllowlisted")
        .withArgs(defaultAddress);
    });

    it("Should mint and call on allowlistShares to allowlistDraggable", async () => {
      const randomAmountToMint = randomBigInt(1, 5000);
      const totalShares = await allowlistShares.totalShares();

      //set new total shares as we mint more
      await allowlistShares.connect(owner).setTotalShares(totalShares + randomAmountToMint);
      const balanceBefore = await allowlistDraggable.balanceOf(sig5.address);
      // mint shares and wrap them in draggable
      await allowlistShares.connect(owner).mintAndCall(sig5.address, await allowlistDraggable.getAddress(), randomAmountToMint, "0x01");
      const balanceAfter = await allowlistDraggable.balanceOf(sig5.address);

      expect(balanceBefore + randomAmountToMint).to.equal(balanceAfter);
    });

    it("Should set type for multiple addresses", async () => {
      const addressesToAdd = [sig2.address, sig3.address, sig4.address];
      // first check if revert non-owner
      await expect(allowlistShares.connect(sig1)["setType(address[],uint8)"](addressesToAdd, TYPE_FORBIDDEN))
        .to.be.revertedWithCustomError(allowlistShares, "Ownable_NotOwner")
        .withArgs(sig1.address);
      // second check if works with owner
      await allowlistShares.connect(owner)["setType(address[],uint8)"](addressesToAdd, TYPE_FORBIDDEN);
      for( let i = 0; i < addressesToAdd.length; i++) {
        expect(await allowlistShares.isForbidden(addressesToAdd[i])).to.be.true;
      }
    })
  });

  describe("Allowlist Draggable", () => {

    it("Should revert if not owner sets type", async () => {
      // use sig1 for allowlist
      const allowlistAddress = sig1.address;
      await expect(allowlistDraggable.connect(sig1)["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED))
        .to.be.revertedWithCustomError(allowlistDraggable, "Ownable_NotOwner")
        .withArgs(sig1.address);
    });

    it("Should allow wrap on allowlist", async () => {
      // use sig1 for allowlist
      const allowlistAddress = sig1.address;
      await allowlistDraggable.connect(owner)["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistDraggable.canReceiveFromAnyone(allowlistAddress)).to.equal(true);
      // set allowance
      await allowlistShares.connect(sig1).approve(await allowlistDraggable.getAddress(), config.infiniteAllowance);

      // wrap w/ permisson
      await allowlistDraggable.connect(sig1).wrap(allowlistAddress, "100");
      const balanceAllow = await allowlistDraggable.balanceOf(allowlistAddress);
      expect(balanceAllow).to.equal(100n);
    });

    it("Should revert wrap to forbidden", async () => {
      //use sig2 for forbidden
      const forbiddenAddress = sig2.address;

      // mint shares
      await allowlistShares.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_ALLOWLISTED);
      await allowlistShares.connect(owner).mint(forbiddenAddress, "1000");

      // set forbidden on draggable
      await allowlistDraggable.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      
      // set allowance
      await allowlistShares.connect(sig2).approve(await allowlistDraggable.getAddress(), config.infiniteAllowance);

      // excpect revert on wrap
      await expect(allowlistDraggable.connect(sig2).wrap(forbiddenAddress, "10"))
        .to.be.revertedWithCustomError(allowlistDraggable, "Allowlist_ReceiverIsForbidden")
        .withArgs(forbiddenAddress);
      const balanceForbidden = await allowlistDraggable.balanceOf(forbiddenAddress);
      expect(balanceForbidden).to.equal(0n);
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
      await allowlistShares.connect(owner).approve(await allowlistDraggable.getAddress(), config.infiniteAllowance);
      await allowlistDraggable.connect(owner).wrap(defaultAddress, "10");
      expect(await allowlistDraggable.canReceiveFromAnyone(defaultAddress)).to.equal(true);     
    });
  });

  describe("Remove restriction", () => {
    it("Should remove restriction", async () => {
      // restrict should be true
      expect(await allowlistShares.restrictTransfers()).to.equal(true);
      expect(await allowlistDraggable.restrictTransfers()).to.equal(true);

      // can only be set by owner
      await expect(allowlistShares.setApplicable(false))
        .to.be.revertedWithCustomError(allowlistShares, "Ownable_NotOwner")
        .withArgs(deployer.address);
      await expect(allowlistDraggable.setApplicable(false))
        .to.be.revertedWithCustomError(allowlistDraggable, "Ownable_NotOwner")
        .withArgs(deployer.address);

      await allowlistShares.connect(owner).setApplicable(false);
      await allowlistDraggable.connect(owner).setApplicable(false);

      // restrict should be false
      expect(await allowlistShares.restrictTransfers()).to.equal(false)
      expect(await allowlistDraggable.restrictTransfers()).to.equal(false)
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
      // use sig4 for allowlist
      const allowlistAddress = sig4.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](allowlistAddress, TYPE_ALLOWLISTED);
      expect(await allowlistShares.canReceiveFromAnyone(allowlistAddress)).to.equal(true);

      // use sig5 as default
      const defaultAddress = sig5.address
      await allowlistShares.connect(owner)["setType(address,uint8)"](defaultAddress, TYPE_DEFAULT);
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);

      // allow transfer from allowlist(sig4) to default(sig5) -- (what failed before with resriction on)
      await allowlistShares.connect(sig4).transfer(defaultAddress, "10");
      // cleans allowlist address to be default now
      expect(await allowlistShares.canReceiveFromAnyone(allowlistAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(allowlistAddress)).to.equal(false);
    });

    it("Should clean forbidden address after removed restriction", async () => {
      // use sig4 for forbidden
      const forbiddenAddress = sig4.address;
      await allowlistShares.connect(owner)["setType(address,uint8)"](forbiddenAddress, TYPE_FORBIDDEN);
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(true);

      // use sig5 as default
      const defaultAddress = sig5.address
      await allowlistShares.connect(owner)["setType(address,uint8)"](defaultAddress, TYPE_DEFAULT);
      expect(await allowlistShares.canReceiveFromAnyone(defaultAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(defaultAddress)).to.equal(false);

      // allow transfer from allowlist(sig4) to default(sig5) -- (what failed before with resriction on)
      await allowlistShares.connect(sig4).transfer(defaultAddress, "10");
      // cleans allowlist address to be default now
      expect(await allowlistShares.canReceiveFromAnyone(forbiddenAddress)).to.equal(false);
      expect(await allowlistShares.isForbidden(forbiddenAddress)).to.equal(false);
    });


    it("Should remove claim when token are transfered", async () => {
      await allowlistDraggable.connect(sig1).approve(await recoveryHub.getAddress(), config.infiniteAllowance);
      const lostAddress = sig3.address;
      const lostSigner = sig3;
      const lostAddressBalance = await allowlistDraggable.balanceOf(lostAddress);

      // declare token lost
      await recoveryHub.connect(sig1).declareLost(await allowlistDraggable.getAddress(), await allowlistDraggable.getAddress(), lostAddress);
      // check if flag is set
      expect(await allowlistDraggable.hasFlag(lostAddress, 10)).to.equal(true);
      // transfer to lost address
      await allowlistDraggable.connect(sig1).transfer(lostAddress, "10");
      // after transfer to lost address still claim on it
      expect(await allowlistDraggable.hasFlag(lostAddress, 10)).to.equal(true);
      // transfer from lost address (to clear claim)
      await allowlistDraggable.connect(lostSigner).transfer(sig1.address, "10");
      // claim cleared
      expect(await allowlistDraggable.hasFlag(lostAddress, 10)).to.equal(false);
      // get collateral
      expect(await allowlistDraggable.balanceOf(lostAddress)).to.equal(await lostAddressBalance * 2n)
    });
  });
});
