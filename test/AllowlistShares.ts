import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import { mintAndWrapByCall } from "../scripts/helpers/mintAndWrap";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("AllowlistShares", function () {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let signer1: HardhatEthersSigner, signer2: HardhatEthersSigner, signer3: HardhatEthersSigner, signer4: HardhatEthersSigner, signer5: HardhatEthersSigner;
  let allowlistShares: Contract;
  
  before(async function() {
    [deployer, owner, signer1, signer2, signer3, signer4, signer5] = await ethers.getSigners();
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    
    setBalance(await signer1.getAddress(), ethers.parseEther("1"));
    await allowlistShares.connect(owner).mint(signer1, 100n);
    await allowlistShares.connect(owner).mint(signer2, 100n);
    await allowlistShares.connect(owner).mint(signer3, 100n);
    await allowlistShares.connect(owner).mint(signer4, 100n);
    await allowlistShares.connect(owner).mint(signer5, 100n);
  });

  it("Should deploy", async function () {
    expect(await allowlistShares.getAddress()).to.exist;
  });

  it("Should get constructor params correctly", async () => {
    expect(await allowlistShares.symbol()).to.equal(TestModuleConfig.allowlistShareConfig.symbol);
    expect(await allowlistShares.name()).to.equal(TestModuleConfig.allowlistShareConfig.name);
    expect(await allowlistShares.terms()).to.equal(TestModuleConfig.allowlistShareConfig.terms);
    expect(await allowlistShares.totalShares()).to.equal(TestModuleConfig.allowlistShareConfig.totalShares);
  });

  it("Should have allowlisting enabled on deploy", async () => {
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    expect(await allowlistShares.restrictTransfers()).to.equal(true)
  });

  it("Should be mintable", async () => {
    const sharesToMint = 100n;
    const oldBalance = await allowlistShares.balanceOf(signer1);
    await allowlistShares.connect(owner).mint(signer1, sharesToMint);
    const newBalance = await allowlistShares.balanceOf(signer1);
    expect(oldBalance + sharesToMint).to.equal(newBalance);
  });

  it("Should have allowlisting enabled on deploy", async () => {
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    expect(await allowlistShares.restrictTransfers()).to.equal(true)
  });

  it("Should let owner enable and disable transfer restrictions", async () => {
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    expect(await allowlistShares.restrictTransfers()).to.equal(true);
    await allowlistShares.connect(owner).setApplicable(false);
    expect(await allowlistShares.restrictTransfers()).to.equal(false);
    await allowlistShares.connect(owner).setApplicable(true);
    expect(await allowlistShares.restrictTransfers()).to.equal(true);
  });

  it("Should not let non-owner enable and disable transfer restrictions", async () => {
    expect(allowlistShares.connect(signer1).setApplicable(false)).to.be.reverted;
  });

  it("Accounts should not have any status by default", async () => {
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    expect(await allowlistShares.canReceiveFromAnyone(signer1)).to.equal(false)
    expect(await allowlistShares.isForbidden(signer1)).to.equal(false)
    expect(await allowlistShares.isPowerlisted(signer1)).to.equal(false)
  });

  it("Should allow setting type by owner", async () => {
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    expect(await allowlistShares.canReceiveFromAnyone(signer1)).to.equal(false)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 1)
    expect(await allowlistShares.canReceiveFromAnyone(signer1)).to.equal(true)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 2)
    expect(await allowlistShares.canReceiveFromAnyone(signer1)).to.equal(false)
    expect(await allowlistShares.isForbidden(signer1)).to.equal(true)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 4)
    expect(await allowlistShares.isForbidden(signer1)).to.equal(false)
    expect(await allowlistShares.isPowerlisted(signer1)).to.equal(true)
  });

  it("Should not allow setting type by non-owner", async () => {
    ({ allowlistShares } = await loadFixture(deployTestModuleFixture));
    await expect(allowlistShares.connect(signer1)["setType(address,uint8)"](signer1, 4)).to.be.reverted
  });

});