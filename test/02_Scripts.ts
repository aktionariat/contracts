import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule from "../ignition/modules/TestModule";
import { setZCHFBalancesForSigners } from "../scripts/helpers/setBalance";
import { mint, mintAndWrap, mintAndWrapByCall } from "../scripts/helpers/mintAndWrap";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("Test Scripts", function () {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let signer1: HardhatEthersSigner, signer2: HardhatEthersSigner, signer3: HardhatEthersSigner, signer4: HardhatEthersSigner, signer5: HardhatEthersSigner;
  let shares: Contract;
  let draggableShares: Contract;
  let zchf: Contract;
  const amount: bigint = 100n;
    
  before(async function() {
    [deployer, owner, signer1, signer2, signer3, signer4, signer5] = await ethers.getSigners();
  });

  // Reset the state before each test
  beforeEach(async function() {
    ({ shares, draggableShares, zchf } = await loadFixture(deployTestModuleFixture));
  });

  it("Set Balance", async function () {
    await setZCHFBalancesForSigners(amount);
    expect(await zchf.balanceOf(signer1)).to.be.equal(amount);
    expect(await zchf.balanceOf(signer2)).to.be.equal(amount);
    expect(await zchf.balanceOf(signer3)).to.be.equal(amount);
    expect(await zchf.balanceOf(signer4)).to.be.equal(amount);
    expect(await zchf.balanceOf(signer5)).to.be.equal(amount);
  });

  it("Mint", async function () {    
    await mint(shares, signer1.address, amount);
    expect(await shares.balanceOf(signer1)).to.be.equal(amount);
  });

  it("Mint and Wrap", async function () {    
    await mintAndWrap(shares, draggableShares, signer1.address, amount);
    expect(await shares.balanceOf(signer1)).to.be.equal(0);
    expect(await draggableShares.balanceOf(signer1)).to.be.equal(amount);
  });

  it("Mint and Wrap - Single Call", async function () {    
    await mintAndWrapByCall(shares, draggableShares, signer1.address, amount);
    expect(await shares.balanceOf(signer1)).to.be.equal(0);
    expect(await draggableShares.balanceOf(signer1)).to.be.equal(amount);
  });
});