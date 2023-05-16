const {network, ethers, deployments } = require("hardhat");
const config = require("../scripts/deploy_config.js");
const { sendEther } = require("./helper/index");
const { expect } = require("chai");


describe("Multisig", () => {
  let multiSigMaster;
  let multiSigCloneFactory;
  let multiSigClone;
  let multiSigClone2;
  let paymentHub;

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

  let randomWallet;
  let ownerWallet;

  before(async () => {
    [owner,adr1,adr2,adr3,adr4,adr5] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];

    await deployments.fixture(["MultiSigCloneFactory", "PaymentHub"]);
    multiSigMaster = await ethers.getContract("MultiSigWalletMasterV4");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");
    paymentHub = await ethers.getContract("PaymentHub");

    randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    const mnemonic = process.env.MNEMONIC;
    ownerWallet = ethers.Wallet.fromMnemonic(mnemonic).connect(ethers.provider);

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

    multiSigClone = await ethers.getContractAt("MultiSigWalletV4",address);

    // initialize is already called with create and should revert
    await expect(multiSigClone.initialize(adr1.address))
      .to.be.revertedWithCustomError(multiSigClone, "Initializable_AlreadyInitalized");
  });

  it("Should create unique contract id for clone", async () => {
    const tx2 = await multiSigCloneFactory.create(owner.address, salts[1]);
    const { events } = await tx2.wait();
    const { address } = events.find(Boolean);
    multiSigClone2 = await ethers.getContractAt("MultiSigWalletV4",address);
    expect(await multiSigClone.contractId()).not.to.equal(await multiSigClone2.contractId())
  });

  it("Should revert when set signer is called from unauthorized address", async () => {
    await expect(multiSigClone.connect(adr1).setSigner(adr1.address, 2))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_UnauthorizedSender")
      .withArgs(adr1.address);
  })

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
    const tx = await multiSigCloneFactory.create(randomWallet.address, salts[2]);
    const { gasUsed: createGasUsed, events } = await tx.wait();
    const { address } = events.find(Boolean);
    const multiSig = await ethers.getContractAt("MultiSigWalletV4",address);

    // tx info
    const net = await ethers.provider.getNetwork();
    const chainid = net.chainId;
    const valueTx = ethers.utils.parseEther("0.5")
    const dataTX = await paymentHub.populateTransaction.transferEther(randomWallet.address);
    for (let seq = 0; seq < 260; seq++) {
      const tx_send_ms = {
        nonce: seq,
        gasPrice: await multiSig.connect(randomWallet).contractId(),
        gasLimit: 21000,
        to: paymentHub.address,
        value: valueTx,
        data: dataTX.data,
        chainId: chainid,
      };
      const flatSig = await randomWallet.signTransaction(tx_send_ms);
      const tx1 = ethers.utils.parseTransaction(flatSig);
      // console.log(tx1);
      const found = await multiSig.checkSignatures(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]);
      expect(found[0]).to.be.equal(randomWallet.address);
    }
  });

  it("Should execute ETH transfer", async () => {
    await owner.sendTransaction({
      to: randomWallet.address,
      value: ethers.utils.parseEther("2")});
    const tx = await multiSigCloneFactory.create(randomWallet.address, salts[3]);
    const { gasUsed: createGasUsed, events } = await tx.wait();
    const { address } = events.find(Boolean);
    const multiSig = await ethers.getContractAt("MultiSigWalletV4",address);

    //send eth
    const tx_send = {
      from: randomWallet.address,
      to: address,
      value: ethers.utils.parseEther("1"),
      nonce: ethers.provider.getTransactionCount(
        randomWallet.address,
          "latest"
      )};
    await randomWallet.sendTransaction(tx_send);
    const msBlanceBefore = await ethers.provider.getBalance(address);
    //console.log("multisig balance: %s", msBlanceBefore);
    const seq = 1;
    const net = await ethers.provider.getNetwork();
    const chainid = net.chainId;
    const valueTx = ethers.utils.parseEther("0.5")
    const dataTX = await paymentHub.populateTransaction.transferEther(randomWallet.address);
    const tx_send_ms = {
      nonce: seq,
      gasPrice: await multiSig.connect(randomWallet).contractId(),
      gasLimit: 21000,
      to: paymentHub.address,
      value: valueTx,
      data: dataTX.data,
      chainId: chainid,
    };
    const flatSig = await randomWallet.signTransaction(tx_send_ms);
    const tx1 = ethers.utils.parseTransaction(flatSig);
    // console.log(tx1);
    await expect(multiSig.checkExecution(tx1.to, tx1.value, tx1.data))
      .to.be.revertedWith("Test passed. Reverting.");
    await expect(multiSig.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.emit(multiSig, "SentEth").withArgs(tx1.to, tx1.value);
    const msBlanceAfter = await ethers.provider.getBalance(address);
    //console.log("multisig balance after: %s", msBlanceAfter);
    expect(msBlanceBefore.sub(valueTx)).to.be.equal(msBlanceAfter);
  });

  it("Should revert when conrtact call is done to an EOA", async () => {
    const dataTX = await multiSigClone.populateTransaction.setSigner(adr2.address, 2);
    const mnemonic = process.env.MNEMONIC;
    // here using adr1.address as EOA
    const tx1 = await getTX(adr1.address, dataTX, multiSigClone, ownerWallet);
    await expect(multiSigClone.checkExecution(tx1.to, tx1.value, tx1.data))
      .to.be.revertedWithCustomError(multiSigClone, "Address_NotTransferNorContract")
      .withArgs(adr1.address);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Address_NotTransferNorContract")
      .withArgs(adr1.address);
  })
  
  it("Should revert when signature data is missing, wrong or has duplicates", async () => {
    const dataTX = await multiSigClone.populateTransaction.setSigner(adr2.address, 2);
    const tx1 = await getTX(multiSigClone.address, dataTX, multiSigClone, ownerWallet);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [], [], []))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_SignatureMissing");
    await expect(multiSigClone.execute(tx1.nonce, adr1.address, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidSignDataOrInsufficientCosigner");
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10, tx1.v -10], [tx1.r, tx1.r], [tx1.s, tx1.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_DuplicateSignature");
  })

  it("Should revert when new signer is contract", async () => {
    const dataTX = await multiSigClone.populateTransaction.setSigner(multiSigClone.address, 2);
    const tx1 = await getTX(multiSigClone.address, dataTX, multiSigClone, ownerWallet);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidSigner")
      .withArgs(multiSigClone.address);
  })

  it("Should revert when new signer is 0x0", async () => {
    const dataTX = await multiSigClone.populateTransaction.setSigner(ethers.constants.AddressZero, 2);
    const tx1 = await getTX(multiSigClone.address, dataTX, multiSigClone, ownerWallet);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidSigner")
      .withArgs(ethers.constants.AddressZero);
  })

  it("Should revert when new signer count is 0", async () => {
    const dataTX = await multiSigClone.populateTransaction.setSigner(adr1.address, 0);
    const tx = await getTX(multiSigClone.address, dataTX, multiSigClone, ownerWallet);
    multiSigClone.execute(tx.nonce, tx.to, tx.value, tx.data, [tx.v - 10], [tx.r], [tx.s]);
    const dataTX1 = await multiSigClone.populateTransaction.setSigner(owner.address, 0);
    const tx1 = await getTX(multiSigClone.address, dataTX1, multiSigClone, ownerWallet);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InsufficientSigners");
  })

  it("Should execute setSigner called from multisig", async () => {
    const dataTX = await multiSigClone.populateTransaction.setSigner(adr2.address, 2);
    const tx1 = await getTX(multiSigClone.address, dataTX, multiSigClone, ownerWallet);
    await multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]);
    expect(await multiSigClone.signers(adr2.address)).to.be.equal(2);
  });

  it("Should revert on empty signature", async () => {
    const receiver = ethers.Wallet.createRandom();
    const attacker = adr5;
		expect(await ethers.provider.getBalance(receiver.address)).to.be.eq(0);
		await expect(multiSigClone.connect(attacker).execute(1, receiver.address, ethers.utils.parseEther("1"), [], [], [], []))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_SignatureMissing");
		expect(await ethers.provider.getBalance(receiver.address)).to.be.eq(0);
  })

  it("Should be able to migrate signer to new address", async () => {
    // add new signer
    await multiSigClone.setSigner(adr3.address, 2);
    // revert migrate if destination isn't new
    await expect(multiSigClone.connect(adr3)["migrate(address)"](owner.address))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidDestination")
      .withArgs(owner.address);
    // migrate to adr4 direkt 
    await expect(multiSigClone.connect(adr3)["migrate(address)"](adr4.address))
      .to.emit(multiSigClone, "SignerChange")
      .withArgs(adr4.address, 2);
    expect(await multiSigClone.signerCount()).to.be.equal(3);
    expect(await multiSigClone.signers(adr4.address)).to.be.equal(2);
    expect(await multiSigClone.signers(adr3.address)).to.be.equal(0);
    // migrate via proposal
    const dataTX = await multiSigClone.populateTransaction["migrate(address,address)"](adr4.address, adr3.address);
    const tx1 = await getTX(multiSigClone.address, dataTX, multiSigClone, ownerWallet);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.v - 10], [tx1.r], [tx1.s]))
      .to.emit(multiSigClone, "SignerChange")
      .withArgs(adr3.address, 2);
    expect(await multiSigClone.signerCount()).to.be.equal(3);
    expect(await multiSigClone.signers(adr4.address)).to.be.equal(0);
    expect(await multiSigClone.signers(adr3.address)).to.be.equal(2);
  })

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

  async function getTX(to, dataTX, multisigclone, wallet) {
    const contractId = await multisigclone.connect(owner).contractId();
    const seq = await multisigclone.nextNonce();
    const net = await ethers.provider.getNetwork();
    const chainid = net.chainId;
    const tx_send_ms = {
      nonce: seq,
      gasPrice: contractId,
      gasLimit: 21000,
      to: to,
      data: dataTX.data,
      chainId: chainid,
    };
    const flatSig = await wallet.signTransaction(tx_send_ms);
    const tx1 = ethers.utils.parseTransaction(flatSig);
    return tx1;
  }
})
