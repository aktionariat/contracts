import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule from "../ignition/modules/TestModule";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import { mintAndWrapByCall } from "../scripts/helpers/mintAndWrap";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("ERC20Cancelled", function () {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let signer1: HardhatEthersSigner, signer2: HardhatEthersSigner, signer3: HardhatEthersSigner, signer4: HardhatEthersSigner, signer5: HardhatEthersSigner;
  let shares: Contract;
  let draggableShares: Contract;
  let erc20Cancelled: Contract;
  
  before(async function() {
    [deployer, owner, signer1, signer2, signer3, signer4, signer5] = await ethers.getSigners();
  });

  beforeEach(async function() {
    ({ shares, draggableShares, erc20Cancelled } = await loadFixture(deployTestModuleFixture));
  });

  it("Set Base and SHA correctly", async function () {
    const { shares, draggableShares, erc20Cancelled } = await loadFixture(deployTestModuleFixture);
    expect(await erc20Cancelled.BASE()).to.be.equal(shares);
    expect(await erc20Cancelled.SHA()).to.be.equal(draggableShares);
  });

  it("Should replace Wrapped with ERC20Cancelled and burn all Shares", async function () {    
    // Distribute 1000 draggable shares
    const totalShares = await shares.totalShares();
    await mintAndWrapByCall(shares, draggableShares, signer1.address, totalShares / 4n);    
    await mintAndWrapByCall(shares, draggableShares, signer2.address, totalShares / 4n); 
    await mintAndWrapByCall(shares, draggableShares, signer3.address, totalShares / 4n);
    await mintAndWrapByCall(shares, draggableShares, signer4.address, totalShares / 10n);
    await mintAndWrapByCall(shares, draggableShares, signer5.address, totalShares / 20n);

    // Quorum sends draggableShares to erc20Cancelled
    await draggableShares.connect(signer1).transfer(await erc20Cancelled.getAddress(), await draggableShares.balanceOf(signer1));
    await draggableShares.connect(signer2).transfer(await erc20Cancelled.getAddress(), await draggableShares.balanceOf(signer2));
    await draggableShares.connect(signer3).transfer(await erc20Cancelled.getAddress(), await draggableShares.balanceOf(signer3));

    // ERC20Cancelled should have enough shares to pass the quorum now
    const quorumMigration = await draggableShares.quorumMigration();
    expect(await draggableShares.balanceOf(await erc20Cancelled.getAddress())).to.be.greaterThanOrEqual(totalShares / 10000n * quorumMigration)

    // Anyone can call burnThemAll now
    await erc20Cancelled.burnThemAll()

    // Draggable must now wrap the "Cancelled" token
    const newWrapped = await ethers.getContractAt("ERC20Cancelled", await draggableShares.wrapped());
    expect(newWrapped).to.equal(erc20Cancelled);

    // Everybody should still have the draggable, but wrapping the new token. First users were the initiators.
    expect(await draggableShares.balanceOf(signer1)).to.equal(0);
    expect(await draggableShares.balanceOf(signer2)).to.equal(0);
    expect(await draggableShares.balanceOf(signer3)).to.equal(0);
    expect(await draggableShares.balanceOf(signer4)).to.equal(totalShares / 10n);
    expect(await draggableShares.balanceOf(signer5)).to.equal(totalShares / 20n);

    // All Shares should be burned. There should be no shares left locked in the DraggableShares contract. Also noone should have base shares anymore.
    expect(await shares.balanceOf(draggableShares)).to.be.equal(0);
    expect(await shares.balanceOf(signer1)).to.equal(0);
    expect(await shares.balanceOf(signer2)).to.equal(0);
    expect(await shares.balanceOf(signer3)).to.equal(0);
    expect(await shares.balanceOf(signer4)).to.equal(0);
    expect(await shares.balanceOf(signer5)).to.equal(0);
    expect(await shares.totalSupply()).to.equal(0);

  });
});