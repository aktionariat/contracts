const {network, ethers, deployments } = require("hardhat");
const config = require("../scripts/deploy_config.js");
const { sendEther } = require("./helper/index");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

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
      ethers.utils.formatBytes32String('3'),
      ethers.utils.formatBytes32String('4')]

  const lowerRealV = 27;
  const chain_id_inc = 35;

  before(async () => {
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];

    await deployments.fixture(["MultiSigCloneFactory"]);
    multiSigMaster = await ethers.getContract("MultiSigWalletMasterV2");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");

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

    multiSigClone = await ethers.getContractAt("MultiSigWalletV2",address);

    // initialize is already called with create and should revert
    await expect(multiSigClone.initialize(adr1.address)).to.be
        .revertedWith("already initialized");
  });

  it("Should create unique contract id for clone", async () => {
    const tx2 = await multiSigCloneFactory.create(owner.address, salts[1]);
    const { events } = await tx2.wait();
    const { address } = events.find(Boolean);
    multiSigClone2 = await ethers.getContractAt("MultiSigWalletV2",address);
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

  it("Should emit event when ether received", async () => {
    const value = ethers.utils.parseEther("1");
      await expect(owner.sendTransaction({
        to: multiSigClone.address,
        value: value
      }))
        .to.emit(multiSigClone, 'Received')
        .withArgs(owner.address, value);
  });

  it("Should check signatures successful", async () => {
    const wallet =  ethers.Wallet.createRandom().connect(ethers.provider);
    const tx = await multiSigCloneFactory.create(wallet.address, salts[2]);
    const { gasUsed: createGasUsed, events } = await tx.wait();
    const { address } = events.find(Boolean);
    const multiSig = await ethers.getContractAt("MultiSigWalletV2",address);

    // tx info
    const net = await ethers.provider.getNetwork();
    const chainid = net.chainId;
    const valueTx = ethers.utils.parseEther("0.5")
    for (let seq = 0; seq < 260; seq++) {
      const tx_send_ms = {
        nonce: seq,
        gasPrice: await multiSig.connect(wallet).contractId(),
        gasLimit: 21000,
        to: wallet.address,
        value: valueTx,
        data: 0x0,
        chainId: chainid,
      };
      const flatSig = await wallet.signTransaction(tx_send_ms);
      const tx1 = ethers.utils.parseTransaction(flatSig);
      // console.log(tx1);
      const found = await multiSig.checkSignatures(seq, wallet.address, valueTx, [], [tx1.v - 10], [tx1.r], [tx1.s]);
      expect(found[0]).to.be.equal(wallet.address);
    }
   
  });

  it("Should execute ETH transfer", async () => {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    await owner.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther("2")});
    const tx = await multiSigCloneFactory.create(wallet.address, salts[3]);
    const { gasUsed: createGasUsed, events } = await tx.wait();
    const { address } = events.find(Boolean);
    const multiSig = await ethers.getContractAt("MultiSigWalletV2",address);

    //send eth
    const tx_send = {
      from: wallet.address,
      to: address,
      value: ethers.utils.parseEther("1"),
      nonce: ethers.provider.getTransactionCount(
          wallet.address,
          "latest"
      )};
    await wallet.sendTransaction(tx_send);
    const msBlanceBefore = await ethers.provider.getBalance(address);
    //console.log("multisig balance: %s", msBlanceBefore);
    const seq = 1;
    const net = await ethers.provider.getNetwork();
    const chainid = net.chainId;
    const valueTx = ethers.utils.parseEther("0.5")
    const tx_send_ms = {
      nonce: seq,
      gasPrice: await multiSig.connect(wallet).contractId(),
      gasLimit: 21000,
      to: wallet.address,
      value: valueTx,
      data: 0x0,
      chainId: chainid,
    };
    const flatSig = await wallet.signTransaction(tx_send_ms);
    const tx1 = ethers.utils.parseTransaction(flatSig);
    // console.log(tx1);
    await multiSig.execute(seq, wallet.address, valueTx, [], [tx1.v - 10], [tx1.r], [tx1.s]);
    const msBlanceAfter = await ethers.provider.getBalance(address);
    //console.log("multisig balance after: %s", msBlanceAfter);
    expect(msBlanceBefore.sub(valueTx)).to.be.equal(msBlanceAfter);
  });



  describe("RLPEncode", () => {
    // skipped: needs public encode methed in multisig contract
    it.skip("Should encode correct", async () => {
      const testData = "0x12345678";
      for (let index = 128; index < 500; index++) {        
        const test = await multiSigClone.toBytes(index);
        const encodedTestDataEthers = ethers.utils.RLP.encode(test);
        const encodedTestData = await multiSigClone.rlpEncode(test);
        const decoded = ethers.utils.RLP.decode(encodedTestData);
        expect(encodedTestDataEthers).to.be.equal(encodedTestData);
      }
    });
  });
})
