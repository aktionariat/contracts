const {network, ethers, deployments } = require("hardhat");
const { expect } = require("chai");
const config = require("../migrations/migration_config");

describe("Multisig", () => {
  let multiSigMaster;
  let multiSigCloneFactory;
  let multiSigClone;
  let multiSigClone2;
  let forceSend;

  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let accounts;

  const salts = [
      ethers.utils.formatBytes32String('1'),
      ethers.utils.formatBytes32String('2'),
      ethers.utils.formatBytes32String('3')]

  before(async () => {
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];

    await deployments.fixture(["MultiSigCloneFactory"]);
    multiSigMaster = await ethers.getContract("MultiSigWalletMaster");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");

    forceSend = await ethers.getContractFactory("ForceSend")
        .then(factory => factory.deploy())
        .then(contract => contract.deployed());

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
    await expect(multiSigClone.initialize(adr1.address)).to.be
        .revertedWith("Initializable: contract is already initialized");
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
  });

  // is tested via java-backend
  it.skip("Should execute ETH transfer", async () => {
    const wallet = await ethers.Wallet.createRandom();
    await wallet.connect(ethers.provider);
    await forceSend.send(wallet.address, {value: ethers.utils.parseEther("2")});
    const tx = await multiSigCloneFactory.create(wallet.address, salts[2]);
    const { gasUsed: createGasUsed, events } = await tx.wait();
    const { address } = events.find(Boolean);
    const multiSig = await ethers.getContractAt("MultiSigWallet",address);

    //send eth
    const tx_send = {
      from: wallet.address,
      to: address,
      value: ethers.utils.parseEther("1"),
      nonce: ethers.provider.getTransactionCount(
          wallet.address,
          "latest"
      )};
    await wallet.connect(ethers.provider).sendTransaction(tx_send);
    const msBlanceBefore = await ethers.provider.getBalance(address);
    console.log("multisig balance: %s", msBlanceBefore);
    const tx_send_ms = {
      to: wallet.address,
      value: ethers.utils.parseEther("0.5"),
      nonce: ethers.provider.getTransactionCount(
          address,
          "latest"
      )};
    const flatSig = await wallet.connect(ethers.provider).signTransaction(tx_send_ms);
    //console.log(await ethers.utils.parseTransaction(flatSig));
    const tx1 = await ethers.utils.parseTransaction(flatSig);
    const flatSig1 = await owner.signMessage("");
    console.log(flatSig);
    console.log(tx1.data);
    console.log(flatSig1);
    const sig = ethers.utils.splitSignature(flatSig1);
    await expect(multiSig.checkExecution(owner.address, ethers.utils.parseEther("0.5"), [])).to.be.
    revertedWith("Test passed. Reverting.");
    const nonce = ethers.provider.getTransactionCount(wallet.address,"latest");
    console.log(await multiSig.signers(wallet.address));
    console.log(wallet.address);
    await multiSig.execute(nonce, wallet.address, ethers.utils.parseEther("0.5"), tx1.data, [tx1.v], [tx1.r], [tx1.s]);
    //await multiSig.execute(nonce, owner.address, ethers.utils.parseEther("0.5"), [], [sig.v], [sig.r], [sig.s]);
    const msBlanceAfter = await ethers.provider.getBalance(address);
    console.log("multisig balance after: %s", msBlanceAfter);
  });
})