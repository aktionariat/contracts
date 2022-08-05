const {network, ethers, getNamedAccounts} = require("hardhat");
const Chance = require("chance");
const { setBalance, setBalanceWithAmount } = require("./helper/index");
const { expect } = require("chai");

const config = require("../scripts/deploy_config.js");

describe("Lockup Shares", () => {
  let draggable;
  let shares;
  let recoveryHub;
  let baseCurrency;
  let offerFactory;
  let lockupFactory;
  let lockupSharesMaster;

  let deployer
  let owner;
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


  const salts = [
    ethers.utils.formatBytes32String('1'),
    ethers.utils.formatBytes32String('2'),
    ethers.utils.formatBytes32String('3'),
    ethers.utils.formatBytes32String('4'),
    ethers.utils.formatBytes32String('5')]


  before(async () => {
    // get signers and accounts of them
    [deployer,owner,treasury, sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,treasury, sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address, treasury, sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    oracle = owner;
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

    
    //Mint shares to treasury
      //await shares.connect(owner).mint(accounts[i], 1000000);
      await shares.connect(owner).mintAndCall(treasury.address, draggable.address, 100000, 0x0);
    
    // Convert some Shares to DraggableShares
    //await shares.connect().approve(draggable.address, config.infiniteAllowance);
    //await draggable.connect(signers[i]).wrap(accounts[i], 900000);
  

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

      const tx1 = await lockupFactory.create(sig1.address, owner.address, draggable.address, 1, salts[0]);
      const { gasUsed: createGasUsed, events } = await tx1.wait();
      const { address } = events.find(Boolean);
      // log gas usage
      // console.log(`lockupFactory.create: ${createGasUsed.toString()}`);
      
      //check is predicted address is created address
      expect(lockupSharesAddress).to.equal(address);

      lockupShareClone = await ethers.getContractAt("LockupShares",address);

      // initialize is already called with create and should revert
      await expect(lockupShareClone.initialize(sig1.address, owner.address, draggable.address, 1)).to.be
          .revertedWith("already initialized");
    });

    it("Should create unique contract storage for clone", async () => {
      const tx2 = await lockupFactory.create(sig2.address, owner.address, draggable.address, 1, salts[1]);
      const { events } = await tx2.wait();
      const { address } = events.find(Boolean);
      lockupShareClone2 = await ethers.getContractAt("LockupShares",address);
      expect(await lockupShareClone.address).not.to.equal(await lockupShareClone2.address);
      expect(await lockupShareClone.owner()).not.to.equal(await lockupShareClone2.owner());
    });
  });

  describe("Lockup", () => {
    let lockupClone;
    beforeEach(async() => {
      const salt = ethers.utils.formatBytes32String(Date.now().toString());
      const tx = await lockupFactory.create(sig1.address, owner.address, draggable.address, 84600, salt);
      const { events } = await tx.wait();
      const { address } = events.find(Boolean);
      lockupClone = await ethers.getContractAt("LockupShares",address);
      await draggable.connect(treasury).transfer(lockupClone.address, 10);
    });

    it("Should have shares locked up", async() => {
      expect(await lockupClone.balance()).to.be.equal(10);
    });

    it("Should not be able to withdraw shares", async() => {
      await expect(lockupClone.connect(sig2).withdrawShares(draggable.address, sig2.address, 10))
        .to.be.revertedWith("not owner");
      await expect(lockupClone.connect(sig1).withdrawShares(draggable.address, sig1.address, 10))
        .to.be.revertedWith("Lockup");
    });

    it("Should be able to clawback if company", async() => {
      const balanceBefore = await draggable.balanceOf(owner.address);
      await lockupClone.connect(owner).clawback(owner.address, 10);
      const balanceAfter = await draggable.balanceOf(owner.address);
      expect(balanceBefore.add(10)).to.be.equal(balanceAfter);
    });

    it("Should change lockup to withdraw", async() =>{
      await expect(lockupClone.connect(sig1).changeLockup(0))
        .to.revertedWith("not company");

      const blockTimestamp = await (await ethers.provider.getBlock()).timestamp
      
      await expect(lockupClone.connect(owner).changeLockup(0))
        .to.emit(lockupClone, "LockupUpdated");

      const balanceBefore = await draggable.balanceOf(sig1.address);
      await lockupClone.connect(sig1).withdrawShares(draggable.address, sig1.address, 10)
      const balanceAfter = await draggable.balanceOf(sig1.address);
      expect(balanceBefore.add(10)).to.be.equal(balanceAfter);
      
    });

    it("Should be possible to vote on the draggable", async()=>{

    });

    it("Should be possible to unwrap after acquisition", async() => {

    });

  });

});