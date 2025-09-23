import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";


describe("MultichainSharesChild", function () {
  let multichainSharesChild: Contract;

  before(async function() {
    ({ multichainSharesChild } = await connection.ignition.deploy(TestModule));
  });

  it("Should deploy", async function () {
    expect(await multichainSharesChild.getAddress()).to.exist;
  });

  it("Should set owner correctly", async function () {
    expect(await multichainSharesChild.owner()).to.be.equal(owner.address);
  })
});