import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("Test Shares", function () {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let signer1: HardhatEthersSigner, signer2: HardhatEthersSigner;
  
  let shares: Contract;
  let paymentHub: Contract;
  
  before(async function() {
    ({ shares, paymentHub } = await loadFixture(deployTestModuleFixture));
    [deployer, owner, signer1, signer2] = await ethers.getSigners();

    setBalance(await signer1.getAddress(), ethers.parseEther("1"));
    await shares.connect(owner).mint(signer1, 100n);
    await shares.connect(owner).mint(signer2, 100n);
  });
  
  it("Should deploy", async function () {
    expect(await shares.getAddress()).to.exist;
  });

  it("should get constructor params correctly", async () => {
    expect(await shares.symbol()).to.equal(TestModuleConfig.shareConfig.symbol);
    expect(await shares.name()).to.equal(TestModuleConfig.shareConfig.name);
    expect(await shares.terms()).to.equal(TestModuleConfig.shareConfig.terms);
    expect(await shares.totalShares()).to.equal(TestModuleConfig.shareConfig.totalShares);
  });

  it("should be mintable", async () => {
    const sharesToMint = 100n;
    const oldBalance = await shares.balanceOf(signer1);
    await shares.connect(owner).mint(signer1, sharesToMint);
    const newBalance = await shares.balanceOf(signer1);
    expect(oldBalance + sharesToMint).to.equal(newBalance);
  });

  it("should allow infinite allowance", async () => {
    // Allow PaymentHub to spend infinite shares from accounts[0]
    await shares.connect(signer1).approve(await paymentHub.getAddress(), TestModuleConfig.infiniteAllowance);

    // Get allowance before transaction
    const allowanceBefore = await shares.allowance(signer1, await paymentHub.getAddress());

    // Execute transaction. Send any number through paymentHub
    await paymentHub.connect(signer1).multiPay(await shares.getAddress(), [signer2], [1]);

    // Get allowance after transaction
    const allowanceAfter = await shares.allowance(signer1, await paymentHub.getAddress());

    // Infinite approval must not have changed
    expect(allowanceBefore).to.equal(allowanceAfter);
    
  });
});