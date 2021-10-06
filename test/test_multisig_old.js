const {network, ethers, } = require("hardhat");
const { expect } = require("chai");

describe("Multisig", () => {
  let multiSig

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

    multiSig = await ethers.getContractFactory("MultiSig")
                      .then(multiSigFactory => multiSigFactory.deploy(owner.address))
                      .then(multiSig => multiSig.deployed());
  });

  it("Should deploy multiSig  contract", async () => {
    expect(multiSig.address).to.exist;
  });

  it("Should add new signer", async () => {
    multiSig.setSigner(adr1.address, 2);
    expect(await multiSig.signerCount()).to.equal(2);
    /*let tx = [];
    for(let i = 2; i < 5; i++){
      tx[i] = await multiSig.setSigner(accounts[i], i);
      const { gasUsed: createGasUsed } = await tx[i].wait();
      // log gas usage
      console.log(`multiSigClone.setSigner(${i}): ${createGasUsed.toString()}`);
    }*/
  });
})