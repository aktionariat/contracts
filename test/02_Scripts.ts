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

describe("Scripts", function () {
  let signers: HardhatEthersSigner[];
  let shares: Contract;
  let draggableShares: Contract;
  let zchf: Contract;
  const amount: bigint = 100n;
    
  before(async function() {
    signers = await ethers.getSigners();
  });

  beforeEach(async function() {
    ({ shares, draggableShares, zchf } = await loadFixture(deployTestModuleFixture));
  });

  it("Set Balance", async function () {
    await setZCHFBalancesForSigners(amount);
    expect(await zchf.balanceOf(signers[0])).to.be.equal(amount);
    expect(await zchf.balanceOf(signers[1])).to.be.equal(amount);
    expect(await zchf.balanceOf(signers[2])).to.be.equal(amount);
    expect(await zchf.balanceOf(signers[3])).to.be.equal(amount);
    expect(await zchf.balanceOf(signers[4])).to.be.equal(amount);
  });

  it("Mint", async function () {    
    await mint(shares, signers[0].address, amount);
    expect(await shares.balanceOf(signers[0])).to.be.equal(amount);
  });

  it("Mint and Wrap", async function () {    
    await mintAndWrap(shares, draggableShares, signers[0].address, amount);
    expect(await shares.balanceOf(signers[0])).to.be.equal(0);
    expect(await draggableShares.balanceOf(signers[0])).to.be.equal(amount);
  });

  it("Mint and Wrap - Single Call", async function () {    
    await mintAndWrapByCall(shares, draggableShares, signers[0].address, amount);
    expect(await shares.balanceOf(signers[0])).to.be.equal(0);
    expect(await draggableShares.balanceOf(signers[0])).to.be.equal(amount);
  });
});