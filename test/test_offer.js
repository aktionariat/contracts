const {network, ethers, getNamedAccounts} = require("hardhat");
const Chance = require("chance");
const { setBalance, setBalanceWithAmount, randomBigInt, setup } = require("./helper/index");
const { expect } = require("chai");


// Shared  Config
const config = require("../scripts/deploy_config_polygon.js");

describe("Test offer", () => {
  let draggable
  let shares
  let baseCurrency;
  let offerFactory

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
  const licenseFeeAddress = "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D";
  const fee = ethers.parseEther("5000.0")

  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    oracle = owner;
    chance = new Chance();

    // deploy contracts
    await setup(false);

    // get references
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);

    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");

    //Give enough matic
    const balanceToMint = ethers.toBeHex(ethers.parseEther("1000000.0"));
    for( let i = 0; i < accounts.length; i++) {
      await network.provider.send("hardhat_setBalance", [
        accounts[i],
        balanceToMint,
      ]);
    }

  });

  describe("Offer", () => {
    let pricePerShare;
    let salt;
    let offer;
    const feePaid = ethers.parseEther("6000.0");
    const overrides = {
      value: feePaid
    }
    beforeEach(async () => {
      pricePerShare = ethers.parseUnits("2", await baseCurrency.decimals());
      salt = ethers.encodeBytes32String(Date.now().toString());
      await draggable.connect(sig1).makeAcquisitionOffer(salt, pricePerShare, await baseCurrency.getAddress(), overrides)
      offer = await ethers.getContractAt("Offer", await draggable.offer());
    });

    it("Should pay fee", async () => {
      const balance = await ethers.provider.getBalance(licenseFeeAddress);
      expect(balance).to.be.equal(fee);
    });

    it("Should predict offer address", async () => {
      const predictedAddress = await offerFactory.predictOfferAddress(salt, sig1.address, await draggable.getAddress(), pricePerShare, await baseCurrency.getAddress(), config.quorumBps, config.votePeriodSeconds);
      expect(predictedAddress).to.equal(await draggable.offer());
    });

    it("Should able to make aquisition offer", async () => {
      const offerAdr = await draggable.offer();
      expect(offerAdr).to.exist;
      expect(offerAdr).to.not.equal(ethers.ZeroAddress);
    });
    
    it("Should set voted flag and change votes if user votes and changes decision after", async () => {
      await offer.connect(sig1).voteYes();
      // FLAG_VOTED = 1
      expect(await draggable.hasFlag(sig1.address, 1)).to.equal(true);
      expect(await offer.hasVotedYes(sig1.address)).to.be.true;
      expect(await offer.hasVotedNo(sig1.address)).to.be.false;

      // Change to no vote
      await offer.connect(sig1).voteNo();
      expect(await draggable.hasFlag(sig1.address, 1)).to.equal(true);
      expect(await offer.hasVotedYes(sig1.address)).to.be.false;
      expect(await offer.hasVotedNo(sig1.address)).to.be.true;

      // Change back to yes vote
      await offer.connect(sig1).voteYes();
      expect(await draggable.hasFlag(sig1.address, 1)).to.equal(true);
      expect(await offer.hasVotedYes(sig1.address)).to.be.true;
      expect(await offer.hasVotedNo(sig1.address)).to.be.false;
    });

    it("Should not allow double voting (votes get counted multiple times", async () => {
      await offer.connect(sig1).voteYes();
      const yesVotes = await offer.yesVotes();
      const voterShares = await draggable.balanceOf(sig1.address);
      expect(yesVotes).to.be.equal(voterShares);
      
      // Vote again
      await offer.connect(sig1).voteYes();
      const yesVotesAfter = await offer.yesVotes();
      expect(yesVotesAfter).to.be.equal(voterShares);
    });

    it("Should update votes if token is moved", async () => {
      await offer.connect(sig1).voteYes();
      await offer.connect(sig2).voteNo();
      const yesVotes = await offer.yesVotes();
      const noVotes = await offer.noVotes();
      const randomAmount = randomBigInt(1, 100);
      await draggable.connect(sig1).transfer(sig2.address, randomAmount);
      const yesVotesAfter = await offer.yesVotes();
      const noVotesAfter = await offer.noVotes();
      expect(yesVotes - randomAmount).to.be.equal(yesVotesAfter);
      expect(noVotes + randomAmount).to.be.equal(noVotesAfter);
    });

    it("Should revert voting if voting is closed", async () => {
      // move to after voting deadline (60days)
      const votePeriod = await draggable.votePeriod();
      await ethers.provider.send("evm_increaseTime", [Number(votePeriod)]);
      await ethers.provider.send("evm_mine");

      await expect(offer.connect(sig3).voteYes())
        .to.be.revertedWithCustomError(offer, "Offer_VotingEnded");
    });

    it("Should revert if reportExternalVotes isn't called from oracle or to many votes are reported", async () => {
      const tooManyExternalTokens = 300000000n;
      const externalTokens = 3000000n;
      const totalVotingTokens = await draggable.totalVotingTokens();
      const totalSupply = await draggable.totalSupply();
      await expect(offer.connect(sig1).reportExternalVotes(externalTokens, 0))
        .to.be.revertedWithCustomError(offer, "Offer_InvalidSender")
        .withArgs(sig1.address);
      await expect(offer.connect(oracle).reportExternalVotes(tooManyExternalTokens, 0))
        .to.be.revertedWithCustomError(offer, "Offer_TooManyVotes")
        .withArgs(totalVotingTokens, totalSupply + tooManyExternalTokens);
    });

    it("Should revert cancel if not called from the buyer", async () => {
      await expect(offer.connect(sig2).cancel())
        .to.be.revertedWithCustomError(offer, "Offer_InvalidSender")
        .withArgs(sig2.address);
    });

    it("Should able to contest offer after expiry and check if buyer gets overpaid fee back", async () => {
      const thirtydays = 30n*24n*60n*60n;
      const expiry = await draggable.votePeriod().then(period => period + thirtydays);
      await ethers.provider.send("evm_increaseTime", [Number(expiry)]);
      await ethers.provider.send("evm_mine");
      const buyerBalanceBefore = await ethers.provider.getBalance(sig1.address);
      await expect(offer.contest()).to.emit(offer, "OfferEnded").withArgs(sig1.address, false, "expired");
      const buyerBalanceAfter = await ethers.provider.getBalance(sig1.address);
      expect(buyerBalanceAfter - buyerBalanceBefore).to.be.equal(feePaid - fee);
      const offerAfterContest = await draggable.offer();
      expect(offerAfterContest).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should able to contest offer if declined", async () => {
      await offer.connect(owner).voteNo();
      await offer.connect(sig2).voteNo();
      await offer.connect(sig3).voteNo();
      await offer.connect(sig4).voteNo();
      await expect(offer.contest()).to.emit(offer, "OfferEnded").withArgs(sig1.address, false, "declined");
      const offerAfterContest = await draggable.offer();
      expect(offerAfterContest).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should able to contest offer if not well funded", async () => {
      //await setBalanceWithAmount(baseCurrency, config.xchfBalanceSlot, [sig1.address], ethers.parseUnits("1"));
      await setBalanceWithAmount(baseCurrency, config.baseCurrencyBalanceSlot, [sig1.address], ethers.parseUnits("10", await baseCurrency.decimals()));;
      await expect(offer.contest()).to.emit(offer, "OfferEnded").withArgs(sig1.address, false, "lack of funds");
      const offerAfterContest = await draggable.offer();
      expect(offerAfterContest).to.equal("0x0000000000000000000000000000000000000000");
      await setBalance(baseCurrency, config.baseCurrencyBalanceSlot, [sig1.address]);
    });

    it("Should revert competing offer if it isn't in same currency", async () => {
      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.encodeBytes32String('1'), ethers.parseUnits("3", await baseCurrency.decimals()), config.wbtcAddress, overrides))
        .to.be.revertedWithCustomError(offer, "Offer_OfferInWrongCurrency")
    });
    
    it("Should be able to make better offer", async () => {
      // offer from sig1
      const offerBefore = await ethers.getContractAt("Offer", await draggable.offer());
      expect(offerBefore).to.exist;
      
      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.encodeBytes32String('2'), ethers.parseUnits("1", await baseCurrency.decimals()), await baseCurrency.getAddress(), overrides))
        .to.be.revertedWithCustomError(offer, "Offer_OldOfferBetter")
        .withArgs(await offer.price(),ethers.parseUnits("1", await baseCurrency.decimals()));
      expect(await draggable.connect(sig1).makeAcquisitionOffer(ethers.encodeBytes32String('2'), ethers.parseUnits("2.3", await baseCurrency.decimals()), await baseCurrency.getAddress(), overrides))
        .to.emit(offer, "OfferEnded")
        .withArgs(sig1.address, false, "replaced");
      
      // new offer from sig1
      const offerAfter = await ethers.getContractAt("Offer", await draggable.offer());
      expect(offerAfter).to.exist;
      expect(await offerAfter.getAddress()).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(offerAfter).to.not.equal(offerBefore);
      expect(await offerBefore.isKilled()).to.be.true;
    });

    it("Should revert if competing offer isn't called from token", async () => {
      const tx = await offerFactory.connect(sig2).create(
        ethers.encodeBytes32String('3'), sig2.address, ethers.parseUnits("2.3", await baseCurrency.decimals()), await baseCurrency.getAddress(), config.quorumBps, config.votePeriodSeconds, overrides);
      const { logs } = await tx.wait();
      await expect(offer.connect(sig2).makeCompetingOffer(logs[0].address))
        .to.be.revertedWithCustomError(offer, "Offer_InvalidSender")
        .withArgs(sig2.address);
    });

    it("Should revert if notifyMoved isn't called from token", async () => {
      await expect(offer.connect(sig1).notifyMoved(sig1.address, sig2.address, ethers.parseUnits("1")))
        .to.be.revertedWithCustomError(offer, "Offer_InvalidSender")
        .withArgs(sig1.address);
    });

    it("Should revert competing offer if old offer is already accepted", async () => {
      // collect external vote (total is 10 mio, 6accounts have each 900k, to get over 75% 3mio external votes are good )
      const externalTokens = 3000000n;
      await offer.connect(oracle).reportExternalVotes(externalTokens, 0);
      for(let i = 0; i<signers.length; i++){
        await offer.connect(signers[i]).voteYes();
      }

      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.encodeBytes32String(Date.now().toString()), ethers.parseUnits("2.3", await baseCurrency.decimals()), await baseCurrency.getAddress(), overrides))
        .to.be.revertedWithCustomError(offer, "Offer_AlreadyAccepted");
    });

    it("Should revert competing offer if user account isn't well funded", async () => {
      await expect(draggable.connect(sig1).makeAcquisitionOffer(ethers.encodeBytes32String(Date.now().toString()), ethers.parseUnits("100"), await baseCurrency.getAddress(), overrides))
        .to.be.revertedWithCustomError(offer, "Offer_NotWellFunded");
    });

    it("Should revert execution if sender isn't buyer", async () => {
      await expect(offer.connect(sig2).execute())
        .to.be.revertedWithCustomError(offer, "Offer_InvalidSender")
        .withArgs(sig2.address);
    });

    it("Should revert execution if offer isn't accepted", async () => {
      await expect(offer.connect(sig1).execute())
        .to.be.revertedWithCustomError(offer, "Offer_NotAccepted");
    });

    it("Should revert execution if offer is already killed", async () => {
      offer.connect(sig1).cancel();
      await expect(offer.connect(sig1).execute())
        .to.be.revertedWithCustomError(offer, "Offer_IsKilled");
    });

    it("Should revert if transfer of offer currency fails", async () => {
      // collect external vote (total is 10 mio, 6accounts have each 900k, to get over 75% 3mio external votes are good )
      const externalTokens = 3000000n;
      await offer.connect(oracle).reportExternalVotes(externalTokens, 0);
      for(let i = 0; i<signers.length; i++){
        await offer.connect(signers[i]).voteYes();
      }
      //set balance to low to transfer
      await setBalanceWithAmount(baseCurrency, config.baseCurrencyBalanceSlot, [sig1.address], ethers.parseUnits("10", await baseCurrency.decimals()));
      await expect(offer.connect(sig1).execute()).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      //set balance back
      await setBalance(baseCurrency, config.baseCurrencyBalanceSlot, [sig1.address]);
    });

    it("Should be able to execute offer", async () => {
      // buyer share balance before voting/excute
      const buyerBal = await shares.balanceOf(sig1.address);

      // vote and get total of draggable shares
      let draggableTotal = 0n
      for(let i = 0; i<signers.length; i++){
        await offer.connect(signers[i]).voteYes();
        draggableTotal = await draggable.balanceOf(accounts[i]).then(bal => bal + draggableTotal);
      }

      // collect external vote
      const externalTokens = 100000n;
      await offer.connect(oracle).reportExternalVotes(externalTokens, 0);

      // execute revert as external+yes in not 75% of total shares
      await expect(offer.connect(sig1).execute())
        .to.be.revertedWithCustomError(offer, "Offer_NotAccepted");

      // move to after voting deadline (60days)
      const votePeriod = await draggable.votePeriod();
      await ethers.provider.send("evm_increaseTime", [Number(votePeriod)]);
      await ethers.provider.send("evm_mine");

      expect(await offer.isDeclined()).to.be.false;

      //execute now after deadline only needs more 75% of total votes
      await baseCurrency.connect(sig1).approve(await offer.getAddress(), config.infiniteAllowance);
      await expect(offer.connect(sig1).execute())
        .to.emit(draggable, "NameChanged")
        .withArgs(`${config.baseCurrencyName} (Wrapped)`, `${config.baseCurrencySymbol}S`);

      // after execute all draggable shares are transfered to the buyer, if the buyer already had
      // shares they have to be added to compare to the new balance
      expect(await shares.balanceOf(sig1.address)).to.equal(draggableTotal + buyerBal);

      // wrapped token in draggable is now base currency
      expect(await draggable.wrapped()).to.equal(await baseCurrency.getAddress());

      // balance of draggable in base currency is pricePerShare*totalSupply
      const draggableBaseCurrencyBalance = await baseCurrency.balanceOf(await draggable.getAddress());
      const draggableTotalSupply = await draggable.totalSupply();
      expect(draggableBaseCurrencyBalance).to.equal(await draggableTotalSupply * pricePerShare);

      // unwrap conversion factor is base currency balance / totalsupply
      const factor = await draggable.unwrapConversionFactor();
      expect(factor).to.equal(await draggableBaseCurrencyBalance / draggableTotalSupply);

      // revert new offer after execute
      await expect(draggable.connect(sig1).makeAcquisitionOffer(
        ethers.encodeBytes32String('2'), ethers.parseUnits("2.3", await baseCurrency.decimals()), await baseCurrency.getAddress(), overrides))
          .to.be.revertedWithCustomError(draggable, "Draggable_NotBinding");

      // should be able to unwrap token
      const baseBefore = await baseCurrency.balanceOf(sig2.address);
      const draggableBefore = await draggable.balanceOf(sig2.address);
      //console.log(factor.toString());
      await draggable.connect(sig2).unwrap(10);
      const draggableAfter = await draggable.balanceOf(sig2.address);
      const baseAfter = await baseCurrency.balanceOf(sig2.address);
      expect(draggableBefore - 10n).to.equal(draggableAfter);
      expect(baseBefore + factor * 10n).to.equal(baseAfter);
    });

    afterEach(async () => {
      const offer = await ethers.getContractAt("Offer", await draggable.offer());
      if(await offer.getAddress() !== "") { 
        await offer.connect(sig1).cancel();
      }
    });
  });

});