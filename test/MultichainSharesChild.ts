import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule from "../ignition/modules/TestModule";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("MultichainSharesChild", function () {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let signer1: HardhatEthersSigner, signer2: HardhatEthersSigner, signer3: HardhatEthersSigner, signer4: HardhatEthersSigner, signer5: HardhatEthersSigner;
  let multichainSharesChild: Contract;
  
  before(async function() {
    [deployer, owner, signer1, signer2, signer3, signer4, signer5] = await ethers.getSigners();
  });

  beforeEach(async function() {
    ({ multichainSharesChild } = await loadFixture(deployTestModuleFixture));
  });

  it("Should deploy", async function () {
    expect(await multichainSharesChild.getAddress()).to.exist;
  });

  it("Should set owner correctly", async function () {
    expect(await multichainSharesChild.owner()).to.be.equal(owner.address);
  })

  
});