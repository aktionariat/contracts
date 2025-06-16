import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule from "../ignition/modules/TestModule";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("MultichainSharesMaster", function () {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let signer1: HardhatEthersSigner, signer2: HardhatEthersSigner, signer3: HardhatEthersSigner, signer4: HardhatEthersSigner, signer5: HardhatEthersSigner;
  let allowlistShares: Contract;
  let multichainSharesMaster: Contract;
  
  before(async function() {
    [deployer, owner, signer1, signer2, signer3, signer4, signer5] = await ethers.getSigners();
  });

  beforeEach(async function() {
    ({ allowlistShares, multichainSharesMaster } = await loadFixture(deployTestModuleFixture));
  });

  it("Should deploy", async function () {
    expect(await multichainSharesMaster.getAddress()).to.exist;
  });

  it("Set wrapped token correctly", async function () {
    ({ allowlistShares, multichainSharesMaster } = await loadFixture(deployTestModuleFixture));
    expect(await multichainSharesMaster.wrapped()).to.be.equal(allowlistShares);
  });
});