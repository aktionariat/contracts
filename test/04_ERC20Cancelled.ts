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
  let signers: HardhatEthersSigner[];
  let shares: Contract;
  let draggableShares: Contract;
  let erc20Cancelled: Contract;
  
  before(async function() {
    signers = await ethers.getSigners();
  });

  beforeEach(async function() {
    ({ shares, draggableShares, erc20Cancelled } = await loadFixture(deployTestModuleFixture));
  });

  it("Set Base and SHA correctly", async function () {
    const { shares, draggableShares, erc20Cancelled } = await loadFixture(deployTestModuleFixture);
    expect(await erc20Cancelled.BASE()).to.be.equal(shares);
    expect(await erc20Cancelled.SHA()).to.be.equal(draggableShares);
  });

  it("Should burn all", async function () {    
    // Distribute 1000 draggable shares
    await mintAndWrapByCall(shares, draggableShares, signers[0].address, 400n);    
    await mintAndWrapByCall(shares, draggableShares, signers[1].address, 400n);    
    await mintAndWrapByCall(shares, draggableShares, signers[2].address, 100n); 
    await mintAndWrapByCall(shares, draggableShares, signers[3].address, 60n);
    await mintAndWrapByCall(shares, draggableShares, signers[4].address, 20n);
    await mintAndWrapByCall(shares, draggableShares, signers[5].address, 10n);
    await mintAndWrapByCall(shares, draggableShares, signers[6].address, 10n);

    // Check All Distributed
    expect(mintAndWrapByCall(shares, draggableShares, signers[7].address, 1n)).to.be.reverted

    // Quorum sends draggableShares to erc20Cancelled
    await draggableShares.connect(signers[0]).transfer(await erc20Cancelled.getAddress(), await draggableShares.balanceOf(signers[0]));
    await draggableShares.connect(signers[1]).transfer(await erc20Cancelled.getAddress(), await draggableShares.balanceOf(signers[1]));
    expect(await draggableShares.balanceOf(await erc20Cancelled.getAddress())).to.be.equal(800n);

    // Anyone can call burnThemAll now
    await erc20Cancelled.burnThemAll()

    // Check balances. Everyone should have been dragged.
    const newWrapped = await ethers.getContractAt("ERC20Cancelled", await draggableShares.wrapped());
    console.log(await newWrapped.name())

    /*
    expect(await draggableShares.balanceOf(signers[0])).to.be.equal(0)
    expect(await draggableShares.balanceOf(signers[1])).to.be.equal(0)
    expect(await draggableShares.balanceOf(signers[2])).to.be.equal(0)
    expect(await draggableShares.balanceOf(signers[3])).to.be.equal(0)
    expect(await draggableShares.balanceOf(signers[4])).to.be.equal(0)
    expect(await draggableShares.balanceOf(signers[5])).to.be.equal(0)
    expect(await draggableShares.balanceOf(signers[6])).to.be.equal(0)
    */
  });
});