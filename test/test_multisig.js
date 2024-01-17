const {network, ethers, deployments } = require("hardhat");
const config = require("../scripts/deploy_config_polygon.js");
const { getTX } = require("./helper/index");
const { expect } = require("chai");
const { Transaction, Typed } = require("ethers");


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
      ethers.encodeBytes32String('1'),
      ethers.encodeBytes32String('2'),
      ethers.encodeBytes32String('3'),
      ethers.encodeBytes32String('4'),
      ethers.encodeBytes32String('5')]

  const lowerRealV = 27;
  const chain_id_inc = 35;

  let chainid;


  let randomWallet;
  let ownerWallet;

  before(async () => {
    [deployer,owner,adr1,adr2,adr3,adr4,adr5] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];

    await deployments.fixture(["MultiSigCloneFactory", "PaymentHub"]);
    multiSigMaster = await ethers.getContract("MultiSigWalletMaster");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");
    paymentHub = await ethers.getContract("PaymentHub");

    randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    const mnemonic = ethers.Mnemonic.fromPhrase(process.env.MNEMONIC);
    //ownerWallet = ethers.Wallet.fromPhrase(mnemonic, "m/44'/60'/0'/0/1").connect(ethers.provider);
    ownerWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic,"m/44'/60'/0'/0").deriveChild(1).connect(ethers.provider);
    chainid = Number((await ethers.provider.getNetwork()).chainId);
  });

  it("Should deploy multiSig master contract", async () => {
    expect(await multiSigMaster.getAddress).to.exist;
  });

  it("Should deploy multisig clone factory contract", async () => {
    expect(await multiSigCloneFactory.getAddress()).to.exist;
  });

  it("Should deploy a cloned multisig contract", async () => {
    const multiSigAddress = await multiSigCloneFactory.predict(salts[0]);
    expect(multiSigAddress).to.exist;

    const tx1 = await multiSigCloneFactory.create(owner.address, salts[0]);
    const { gasUsed: createGasUsed, logs } = await tx1.wait();
    const address = logs[1].args[0];
    // log gas usage
    // console.log(`multiSigCloneFactory.create: ${createGasUsed.toString()}`);
    
    //check is predicted address is created address
    expect(multiSigAddress).to.equal(address);

    multiSigClone = await ethers.getContractAt("MultiSigWalletMaster",address);

    // initialize is already called with create and should revert
    await expect(multiSigClone.initialize(adr1.address))
      .to.be.revertedWithCustomError(multiSigClone, "Initializable_AlreadyInitalized");
  });

  it("Should create unique contract id for clone", async () => {
    const tx2 = await multiSigCloneFactory.create(owner.address, salts[1]);
    const { logs } = await tx2.wait();
    const address = logs[1].args[0];
    multiSigClone2 = await ethers.getContractAt("MultiSigWalletMaster",address);
    expect(await multiSigClone.contractId()).not.to.equal(await multiSigClone2.contractId())
  });

  it("Should revert when set signer is called from unauthorized address", async () => {
    await expect(multiSigClone.connect(adr1).setSigner(adr1.address, 2))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_UnauthorizedSender")
      .withArgs(adr1.address);
  })

  it("Should add new signer", async () => {
    await multiSigClone.connect(owner).setSigner(adr1.address, 2);
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
    const value = ethers.parseEther("1");
      await expect(owner.sendTransaction({
        to: await multiSigClone.getAddress(),
        value: value
      }))
        .to.emit(multiSigClone, 'Received')
        .withArgs(owner.address, value);
  });

  it("Should check signatures successful", async () => {
    const tx = await multiSigCloneFactory.create(randomWallet.address, salts[2]);
    const { gasUsed: createGasUsed, logs } = await tx.wait();
    //const { address } = events.find(Boolean);
    const address = logs[1].args[0];
    const multiSig = await ethers.getContractAt("MultiSigWalletMaster",address);

    // tx info
    const net = await ethers.provider.getNetwork();
    const valueTx = ethers.parseEther("0.5")
    const dataTX = await paymentHub.transferEther.populateTransaction(randomWallet.address);
    for (let seq = 0; seq < 260; seq++) {
      const tx_send_ms = {
        nonce: seq,
        gasPrice: await multiSig.connect(randomWallet).contractId(),
        gasLimit: 21000,
        to: await paymentHub.getAddress(),
        value: valueTx,
        data: dataTX.data,
        chainId: chainid,
        type: 0
      };
      const flatSig = await randomWallet.signTransaction(tx_send_ms);
      const tx1 = Transaction.from(flatSig);
      //console.log(tx1);
      const found = await multiSig.checkSignatures(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]);
      expect(found[0]).to.be.equal(randomWallet.address);
    }
  });

  it("Should execute ETH transfer", async () => {
    await owner.sendTransaction({
      to: randomWallet.address,
      value: ethers.parseEther("2")});
    const tx = await multiSigCloneFactory.create(randomWallet.address, salts[3]);
    const { gasUsed: createGasUsed, logs } = await tx.wait();
    //const { address } = events.find(Boolean);
    const address = logs[1].args[0];
    const multiSig = await ethers.getContractAt("MultiSigWalletMaster",address);

    //send eth
    const tx_send = {
      from: randomWallet.address,
      to: address,
      value: ethers.parseEther("1"),
      nonce: await ethers.provider.getTransactionCount(randomWallet.address)
    };
    await randomWallet.sendTransaction(tx_send);
    const msBlanceBefore = await ethers.provider.getBalance(address);
    const walletBalBefore = await ethers.provider.getBalance(owner.address);
    //console.log("multisig balance: %s", msBlanceBefore);
    const seq = 1;
    const net = await ethers.provider.getNetwork();
    const valueTx = ethers.parseEther("0.5")
    const dataTX = await paymentHub.transferEther.populateTransaction(randomWallet.address);
    const tx_send_ms = {
      nonce: seq,
      gasPrice: await multiSig.connect(randomWallet).contractId(),
      gasLimit: 21000,
      to: await paymentHub.getAddress(),
      value: valueTx,
      data: dataTX.data,
      chainId: chainid,
      type: 0
    };
    const flatSig = await randomWallet.signTransaction(tx_send_ms);
    const tx1 = ethers.Transaction.from(flatSig);
    // check for replayability
    await expect(randomWallet.sendTransaction(flatSig)).to.be.rejected;
    // console.log(tx1);
    await expect(multiSig.checkExecution(tx1.to, tx1.value, tx1.data))
      .to.be.revertedWith("Test passed. Reverting.");
    await expect(multiSig.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.emit(multiSig, "SentEth").withArgs(tx1.to, tx1.value);
    const msBlanceAfter = await ethers.provider.getBalance(address);
    const walletBalAfter = await ethers.provider.getBalance(owner.address);
    //console.log("multisig balance after: %s", msBlanceAfter);
    expect(msBlanceBefore - valueTx).to.be.equal(msBlanceAfter);
    expect(walletBalBefore).to.be.equal(walletBalAfter);
  });

  it("Should revert when contract call is done to an EOA", async () => {
    const dataTX = await multiSigClone.setSigner.populateTransaction(adr2.address, 2);
    // here using adr1.address as EOA
    const tx1 = await getTX(adr1.address, dataTX, multiSigClone, ownerWallet, chainid);
    await expect(multiSigClone.checkExecution(tx1.to, tx1.value, tx1.data))
      .to.be.revertedWithCustomError(multiSigClone, "Address_NotTransferNorContract")
      .withArgs(adr1.address);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Address_NotTransferNorContract")
      .withArgs(adr1.address);
  })

  it("Should revert when signature data is missing, wrong or has duplicates", async () => {
    const dataTX = await multiSigClone.setSigner.populateTransaction(adr2.address, 2);
    const tx1 = await getTX(await multiSigClone.getAddress(), dataTX, multiSigClone, ownerWallet, chainid);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [], [], []))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_SignatureMissing");
    await expect(multiSigClone.execute(tx1.nonce, adr1.address, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidSignDataOrInsufficientCosigner");
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v, tx1.signature.v], [tx1.signature.r, tx1.signature.r], [tx1.signature.s, tx1.signature.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_DuplicateSignature");
  })

  it("Should revert when new signer is contract", async () => {
    const dataTX = await multiSigClone.setSigner.populateTransaction(await multiSigClone.getAddress(), 2);
    const tx1 = await getTX(await multiSigClone.getAddress(), dataTX, multiSigClone, ownerWallet, chainid);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidSigner")
      .withArgs(await multiSigClone.getAddress());
  })

  it("Should revert when new signer is 0x0", async () => {
    const dataTX = await multiSigClone.setSigner.populateTransaction(ethers.ZeroAddress, 2);
    const tx1 = await getTX(await multiSigClone.getAddress(), dataTX, multiSigClone, ownerWallet, chainid);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InvalidSigner")
      .withArgs(ethers.ZeroAddress);
  })

  it("Should revert when new signer count is 0", async () => {
    const dataTX = await multiSigClone.setSigner.populateTransaction(adr1.address, 0);
    const tx = await getTX(await multiSigClone.getAddress(), dataTX, multiSigClone, ownerWallet, chainid);
    await multiSigClone.execute(tx.nonce, tx.to, tx.value, tx.data, [tx.signature.v], [tx.signature.r], [tx.signature.s]);
    const dataTX1 = await multiSigClone.setSigner.populateTransaction(owner.address, 0);
    const tx1 = await getTX(await multiSigClone.getAddress(), dataTX1, multiSigClone, ownerWallet, chainid);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_InsufficientSigners");
  })

  it("Should execute setSigner called from multisig", async () => {
    const dataTX = await multiSigClone.setSigner.populateTransaction(adr2.address, 2);
    const tx1 = await getTX(await multiSigClone.getAddress(), dataTX, multiSigClone, ownerWallet, chainid);
    await multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]);
    expect(await multiSigClone.signers(adr2.address)).to.be.equal(2);
  });

  it("Should revert on empty signature", async () => {
    const receiver = ethers.Wallet.createRandom();
    const attacker = adr5;
		expect(await ethers.provider.getBalance(receiver.address)).to.be.eq(0);
		await expect(multiSigClone.connect(attacker).execute(1, receiver.address, ethers.parseEther("1"), new Uint8Array(1), [], [], []))
      .to.be.revertedWithCustomError(multiSigClone, "Multisig_SignatureMissing");
		expect(await ethers.provider.getBalance(receiver.address)).to.be.eq(0);
  })

  it("Should be able to migrate signer to new address", async () => {
    // add new signer
    await multiSigClone.connect(owner).setSigner(adr3.address, 2);
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
    const dataTX = await multiSigClone.migrate.populateTransaction(Typed.address(adr4.address), Typed.address(adr3.address));
    const tx1 = await getTX(await multiSigClone.getAddress(), dataTX, multiSigClone, ownerWallet, chainid);
    await expect(multiSigClone.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.emit(multiSigClone, "SignerChange")
      .withArgs(adr3.address, 2);
    expect(await multiSigClone.signerCount()).to.be.equal(3);
    expect(await multiSigClone.signers(adr4.address)).to.be.equal(0);
    expect(await multiSigClone.signers(adr3.address)).to.be.equal(2);
  })

  it("Should revert when nonce is used multiple times", async () => {
    const tx = await multiSigCloneFactory.create(randomWallet.address, salts[4]);
    const { gasUsed: createGasUsed, logs } = await tx.wait();
    //const { address } = events.find(Boolean);
    const address = logs[1].args[0];
    const multiSigNonce = await ethers.getContractAt("MultiSigWalletMaster",address);

    // tx info
    const dataTX = await multiSigClone.setSigner.populateTransaction(adr1.address, 2);
    const contractId = await multiSigNonce.connect(owner).contractId();
    const seq = await multiSigNonce.nextNonce();
    const net = await ethers.provider.getNetwork();
    const tx_send_ms = {
      nonce: seq,
      gasPrice: contractId,
      gasLimit: 21000,
      to: await multiSigNonce.getAddress(),
      data: dataTX.data,
      chainId: chainid,
      type: 0
    };
    const flatSig = await randomWallet.signTransaction(tx_send_ms);
    const tx1 = ethers.Transaction.from(flatSig);
    await multiSigNonce.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]);
    await expect(multiSigNonce.execute(tx1.nonce, tx1.to, tx1.value, tx1.data, [tx1.signature.v], [tx1.signature.r], [tx1.signature.s]))
      .to.be.rejectedWith("used");
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

})
