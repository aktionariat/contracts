const {network, ethers, } = require("hardhat");
const { expect } = require("chai");

describe("Multisig", () => {
  let multiSigMaster
  let multiSigCloneFactory
  let multiSigClone
  let multiSigClone2

  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let accounts;

  const salts = [ethers.utils.formatBytes32String('1'), ethers.utils.formatBytes32String('2')]
  before(async () => {
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];

    multiSigMaster = await ethers.getContractFactory("MultiSigWallet")
                      .then(multiSigMasterFactory => multiSigMasterFactory.deploy())
                      .then(multiSigMaster => multiSigMaster.deployed());

    multiSigCloneFactory = await ethers.getContractFactory("MultiSigCloneFactory")
                            .then(multiSigFactory => multiSigFactory.deploy(multiSigMaster.address))
                            .then(multiSigCloneFactory => multiSigCloneFactory.deployed());

  });

  it("Should deploy multiSig master contract", async () => {
    expect(multiSigMaster.address).to.exist;
  });

  it("Should deploy multisig clone factory contract", async () => {
    expect(multiSigCloneFactory.address).to.exist;
  });

  it("Should deploy a cloned multisig contract", async () => {
    const multiSigAddress = await multiSigCloneFactory.predict(salts[0]);
    expect(multiSigAddress).to.exist;

    const tx1 = await multiSigCloneFactory.create(owner.address, salts[0]);
    const { gasUsed: createGasUsed, events } = await tx1.wait();
    const { address } = events.find(Boolean);
    // log gas usage
    // console.log(`multiSigCloneFactory.create: ${createGasUsed.toString()}`);
    
    //check is predicted address is created address
    expect(multiSigAddress).to.equal(address);

    multiSigClone = await ethers.getContractAt("MultiSigWallet",address);

    // initialize is already called with create and should revert
    await expect(multiSigClone.initialize(adr1.address)).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should create unique contract id for clone", async () => {
    const tx2 = await multiSigCloneFactory.create(owner.address, salts[1]);
    const { events } = await tx2.wait();
    const { address } = events.find(Boolean);
    multiSigClone2 = await ethers.getContractAt("MultiSigWallet",address);
    expect(await multiSigClone.contractId()).not.to.equal(await multiSigClone2.contractId())
  });

  it("Should add new signer", async () => {
    await multiSigClone.setSigner(adr1.address, 2);
    expect(await multiSigClone.signerCount()).to.equal(2);
    /* test multiple calls
    let tx = [];
    for(let i = 2; i < 5; i++){
      tx[i] = await multiSigClone.setSigner(accounts[i], i);
      const { gasUsed: createGasUsed } = await tx[i].wait();
      // log gas usage
      console.log(`multiSigClone.setSigner(${i}): ${createGasUsed.toString()}`);
    }*/
  })
})