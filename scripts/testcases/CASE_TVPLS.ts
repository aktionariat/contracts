import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getImpersonatedSigner } from "../helpers/getImpersonatedSigner";
import { DraggableShares, ERC20Cancelled, Shares } from "../../typechain-types";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { switchForkedNetwork } from "../helpers/switchNetwork";

// Test detokenzation of SIAS

describe("Test Sias Cancelled", function () {
  let deployer: HardhatEthersSigner, signer1: HardhatEthersSigner;

  let tvplMultisig: HardhatEthersSigner;
  let tvplsShareholder1: HardhatEthersSigner, tvplsShareholder2: HardhatEthersSigner;

  let tvpl: Shares;
  let tvpls: DraggableShares;
  let tvplsCancelled: ERC20Cancelled;
  
  before(async function() {
    // This all need to be done on Optimism
    await switchForkedNetwork("optimism");

    [deployer, signer1] = await ethers.getSigners();

    tvplMultisig = await getImpersonatedSigner("0x5f5337f68b0d2f061d54e9ae011159e388ad792f");
    
    tvpl = await ethers.getContractAt("Shares", "0x82cea1306907a8e07e20e82b70d76802c3f90f4e");
    tvpls = await ethers.getContractAt("DraggableShares", "0x8fb94e08bc984497aaaf1a545ed455be89f8c675");
    tvplsCancelled = await ethers.getContractAt("ERC20Cancelled", "0x694c26713472F211f124e7e8E7AF5661D44A9714");
    
    tvplsShareholder1 = await getImpersonatedSigner("0xfb22f3847f6102d55a9ed738b46a9c71d355d373");
    tvplsShareholder2 = await getImpersonatedSigner("0x8f43f51d28c1f4db16a1b554f9e75d7058560e68");
    
    setBalance(await tvplMultisig.getAddress(), ethers.parseEther("1"));
    setBalance(await tvplsShareholder1.getAddress(), ethers.parseEther("1"));
    setBalance(await tvplsShareholder2.getAddress(), ethers.parseEther("1"));
  });

  it("Check start state", async function () {
    expect(await tvpls.balanceOf(tvplsShareholder1)).to.equal(250n);
    expect(await tvpls.balanceOf(tvplsShareholder2)).to.equal(202n);
  });

  /*
  it("Should transfer shares to CSIAS", async function () {
    await sias.connect(siasShareholder1).transfer(siasCancelled.getAddress(), 49054n);
    await sias.connect(siasShareholder2).transfer(siasCancelled.getAddress(), 47165n);

    expect(await sias.balanceOf(siasCancelled)).to.equal(96219);
  });
  */
  

  it("Anyone can call mintToSHA()", async function () {
    await expect(tvplsCancelled.connect(signer1).mintToSHA()).to.not.reverted;
    expect (await tvplsCancelled.balanceOf(tvpls)).to.equal(await tvpls.totalSupply());
  });

  it("Multisig can migrate to cancelled with additional votes", async function () {
    expect(await tvpls.connect(tvplMultisig).migrateWithExternalApproval(tvplsCancelled, 1236200)).to.not.reverted;     
  });

  it("Should have replaced wrapped with ERC20Cancelled", async function () {
    const newWrappedSias = await ethers.getContractAt("ERC20Cancelled", await tvpls.wrapped());
    expect(newWrappedSias).to.equal(tvplsCancelled);
  });

  it("Anyone can call burnBaseToken()", async function () {
    await expect(tvplsCancelled.connect(signer1).burnBaseToken()).to.not.reverted;
  });

  it("Should have burned all shares", async function () {        
    expect(await tvpl.totalSupply()).to.equal(0);
  });
});