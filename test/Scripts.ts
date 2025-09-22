import TestModule from "../ignition/modules/TestModule.js";
import { Contract } from "ethers";
import { expect } from "chai";
import { mint, mintAndWrap, mintAndWrapByCall } from "../scripts/helpers/mintAndWrap.js";
import { setZCHFBalancesForSigners } from "../scripts/helpers/setBalance.js";
import { connection, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";


describe("Scripts", function () {
  let shares: Contract;
  let draggableShares: Contract;
  let zchf: Contract;
  const amount: bigint = 100n;

  // Reset the state before each test
  beforeEach(async function() {
    ({ shares, draggableShares, zchf } = await connection.ignition.deploy(TestModule));
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