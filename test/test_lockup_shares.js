const {network, ethers, getNamedAccounts} = require("hardhat");
const Chance = require("chance");
const { setBalance, setBalanceWithAmount } = require("./helper/index");
const { expect } = require("chai");

const config = require("../scripts/deploy_config.js");

describe("Lockup Shares", () => {
  let draggable;
  let shares;
  let recoveryHub;
  let offerFactory;
  let baseCurrency
  let lockupFactory;
  let lockupSharesMaster;

  let deployer
  let company;
  let treasury
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;
  let oracle;

  let chance;
  let offer;

  const salts = [
    ethers.utils.formatBytes32String('1'),
    ethers.utils.formatBytes32String('2'),
    ethers.utils.formatBytes32String('3'),
    ethers.utils.formatBytes32String('4'),
    ethers.utils.formatBytes32String('5')]

  before(async () => {
    // get signers and accounts of them
    [deployer,company,treasury, sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [company,treasury, sig1,sig2,sig3,sig4,sig5];
    accounts = [company.address, treasury.address, sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    oracle = company;
    chance = new Chance();

    // deploy contracts
    await deployments.fixture([
      "ReoveryHub",
      "OfferFactory",
      "Shares",
      "DraggableShares",
      "LockupSharesMaster",
      "LockupFactory"
    ]);

    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    shares = await ethers.getContract("Shares");
    draggable = await ethers.getContract("DraggableShares");
    lockupSharesMaster = await ethers.getContract("LockupSharesMaster");
    lockupFactory = await ethers.getContract("LockupFactory");

    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);
    
    //Mint shares to treasury
      //await shares.connect(company).mint(accounts[i], 1000000);
      await shares.connect(company).mintAndCall(treasury.address, draggable.address, 100000, 0x0);
    
    // make offer
    let pricePerShare = ethers.utils.parseEther("2");
    let salt = ethers.utils.formatBytes32String('1');
    const overrides = {
      value: ethers.utils.parseEther("5.0")
    }
    await draggable.connect(sig2).makeAcquisitionOffer(salt, pricePerShare, config.baseCurrencyAddress, overrides)
    offer = await ethers.getContractAt("Offer", await draggable.offer());

    await baseCurrency.connect(sig2).approve(offer.address, config.infiniteAllowance);
  

  });

  describe("Deployment", () => {
    it("Should deploy lockup shares master", async () => {
      expect(lockupSharesMaster.address).to.exist;
    });

    it("Should deploy lockup factory", async () => {
      expect(lockupFactory.address).to.exist;
    })
  });

  describe("Cloning", () => {
    it("Should deploy a cloned lockup shares contract", async () => {
      const lockupSharesAddress = await lockupFactory.predict(salts[0]);
      expect(lockupSharesAddress).to.exist;

      const tx1 = await lockupFactory.create(sig1.address, company.address, draggable.address, 1, salts[0]);
      const { gasUsed: createGasUsed, events } = await tx1.wait();
      const event = events.find(x => x.event === "ContractCreated");
      const address = event.args[0];
      // log gas usage
      // console.log(`lockupFactory.create: ${createGasUsed.toString()}`);
      
      //check is predicted address is created address
      expect(lockupSharesAddress).to.equal(address);

      lockupShareClone = await ethers.getContractAt("LockupShares",address);

      // initialize is already called with create and should revert
      await expect(lockupShareClone.initialize(sig1.address, company.address, draggable.address, 1)).to.be
          .revertedWith("already initialized");
    });

    it("Should create unique contract storage for clone", async () => {
      const tx2 = await lockupFactory.create(sig2.address, company.address, draggable.address, 1, salts[1]);
      const { events } = await tx2.wait();
      const event = events.find(x => x.event === "ContractCreated");
      const address = event.args[0];
      lockupShareClone2 = await ethers.getContractAt("LockupShares",address);
      expect(await lockupShareClone.address).not.to.equal(await lockupShareClone2.address);
      expect(await lockupShareClone.owner()).not.to.equal(await lockupShareClone2.owner());
    });
  });

  describe("Lockup", () => {
    let lockupClone;
    beforeEach(async() => {
      const salt = ethers.utils.formatBytes32String(Date.now().toString());
      const tx = await lockupFactory.create(sig1.address, company.address, draggable.address, 84600, salt);
      const { events } = await tx.wait();
      const event = events.find(x => x.event === "ContractCreated");
      const address = event.args[0];
      lockupClone = await ethers.getContractAt("LockupShares",address);
      await draggable.connect(treasury).transfer(lockupClone.address, 10);
    });

    it("Should have shares locked up", async() => {
      expect(await lockupClone.balance()).to.be.equal(10);
    });

    it("Should not be able to withdraw shares", async() => {
      await expect(lockupClone.connect(sig2).withdraw(draggable.address, sig2.address, 10))
        .to.be.revertedWith("not owner");
      await expect(lockupClone.connect(sig1).withdraw(draggable.address, sig1.address, 10))
        .to.be.revertedWith("Lockup");
    });

    it("Should be able to clawback if company", async() => {
      const balanceBefore = await draggable.balanceOf(company.address);
      await lockupClone.connect(company).clawback(company.address, 10);
      const balanceAfter = await draggable.balanceOf(company.address);
      expect(balanceBefore.add(10)).to.be.equal(balanceAfter);
    });

    it("Should change lockup to withdraw", async() =>{
      await expect(lockupClone.connect(sig1).changeLockup(0))
        .to.revertedWith("not company");

      const blockTimestamp = await (await ethers.provider.getBlock()).timestamp
      
      await expect(lockupClone.connect(company).changeLockup(0))
        .to.emit(lockupClone, "LockupUpdated");

      const balanceBefore = await draggable.balanceOf(sig1.address);
      await lockupClone.connect(sig1).withdraw(draggable.address, sig1.address, 10)
      const balanceAfter = await draggable.balanceOf(sig1.address);
      expect(balanceBefore.add(10)).to.be.equal(balanceAfter);
      
    });

    it("Should be possible to vote on the draggable offer", async() => {
      await expect(lockupClone.connect(sig2).vote(true))
        .to.revertedWith("not owner");

      // FLAG_VOTED = 1
      expect(await draggable.hasFlag(lockupClone.address, 1)).to.equal(false);
      expect(await offer.hasVotedYes(lockupClone.address)).to.be.false;
      expect(await offer.hasVotedNo(lockupClone.address)).to.be.false;

      // Change to no vote
      await lockupClone.connect(sig1).vote(false);
      expect(await draggable.hasFlag(lockupClone.address, 1)).to.equal(true);
      expect(await offer.hasVotedYes(lockupClone.address)).to.be.false;
      expect(await offer.hasVotedNo(lockupClone.address)).to.be.true;

      // Change back to yes vote
      await lockupClone.connect(sig1).vote(true);
      expect(await draggable.hasFlag(lockupClone.address, 1)).to.equal(true);
      expect(await offer.hasVotedYes(lockupClone.address)).to.be.true;
      expect(await offer.hasVotedNo(lockupClone.address)).to.be.false;
    });

    it("Should be possible to unwrap after acquisition", async() => {
      const balanceBefore = await lockupClone.balance();
      // move to after voting deadline (60days)
      await lockupClone.connect(sig1).vote(true);
      const votePeriod = await draggable.votePeriod().then(p => p.toNumber());
      await ethers.provider.send("evm_increaseTime", [votePeriod]);
      await ethers.provider.send("evm_mine");
      expect(await offer.isDeclined()).to.be.false;
      // execute
      await offer.connect(sig2).execute();
      // check unwrap
      await lockupClone.connect(company).unwrap(false)
      const balanceBaseCurrency = await baseCurrency.balanceOf(lockupClone.address);
      const unwrapConversionFactor = await draggable.unwrapConversionFactor();
      expect(balanceBefore.mul(unwrapConversionFactor)).to.be.equal(balanceBaseCurrency);
    });

    //ERC20
    it("Should get decimals, name and symbol corrcet", async() => {
      // decimals
      expect(await lockupClone.decimals()).to.be.equal(0);
      // symbol
      expect(await lockupClone.symbol()).to.be.equal("l" + await draggable.symbol())
      // name
      expect(await lockupClone.name()).to.be.equal("locked " + await draggable.name())
    });

    it("Should not be possible to transfer locked tokens", async() => {
      // approve reverts
      await expect(lockupClone.connect(sig1).approve(sig2.address, 100))
        .to.revertedWith("Locked tockens can't be transferred")
      // allowance reverts
      await expect(lockupClone.connect(sig1).allowance(sig2.address, sig1.address))
        .to.revertedWith("Locked tockens can't be transferred")
      // transfer reverts
      await expect(lockupClone.connect(sig1).transfer(sig2.address, 100))
        .to.revertedWith("Locked tockens can't be transferred")
      // transferFrom reverts
      await expect(lockupClone.connect(sig1).transferFrom(sig2.address, sig1.address, 100))
        .to.revertedWith("Locked tockens can't be transferred")
    });

  });

});