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

  let siasMultisig: HardhatEthersSigner;
  let siasShareholder1: HardhatEthersSigner, siasShareholder2: HardhatEthersSigner;

  let sia: Shares;
  let sias: DraggableShares;
  let siasCancelled: ERC20Cancelled;
  
  before(async function() {
    // This all need to be done on Optimism
    await switchForkedNetwork("optimism");

    [deployer, signer1] = await ethers.getSigners();

    siasMultisig = await getImpersonatedSigner("0x74B9B8220AE60Cd29076419E85e6cC318d841638");
    
    sia = await ethers.getContractAt("Shares", "0x1A0561289120f816580B514D8CBD48C28e2270E1");
    sias = await ethers.getContractAt("DraggableShares", "0x5Ad323D764301E057614eDb0449f470d68EA9485");
    siasCancelled = await hre.ethers.deployContract("ERC20Cancelled", [await sias.getAddress()]);
    
    siasShareholder1 = await getImpersonatedSigner("0x74B9B8220AE60Cd29076419E85e6cC318d841638");
    siasShareholder2 = await getImpersonatedSigner("0x4461A0A2A769cc8F823E5b7bef64aA70D750689f");
    
    setBalance(await siasMultisig.getAddress(), ethers.parseEther("1"));
    setBalance(await siasShareholder1.getAddress(), ethers.parseEther("1"));
    setBalance(await siasShareholder2.getAddress(), ethers.parseEther("1"));
  });

  it("Check start state", async function () {
    expect(await sias.balanceOf(siasShareholder1)).to.equal(49054n);
    expect(await sias.balanceOf(siasShareholder2)).to.equal(47165n);
  });

  it("Should transfer shares to CSIAS", async function () {
    await sias.connect(siasShareholder1).transfer(siasCancelled.getAddress(), 49054n);
    await sias.connect(siasShareholder2).transfer(siasCancelled.getAddress(), 47165n);

    expect(await sias.balanceOf(siasCancelled)).to.equal(96219);
  });
  

  it("Anyone can call mintToSHA()", async function () {
    await expect(siasCancelled.connect(signer1).mintToSHA()).to.not.reverted;
    expect (await siasCancelled.balanceOf(sias)).to.equal(await sias.totalSupply());
  });

  it("Multisig can migrate to cancelled with additional votes", async function () {
    expect(await sias.connect(siasMultisig).migrateWithExternalApproval(siasCancelled, 999980n)).to.not.reverted;     
  });

  it("Should have replaced wrapped with ERC20Cancelled", async function () {
    const newWrappedSias = await ethers.getContractAt("ERC20Cancelled", await sias.wrapped());
    expect(newWrappedSias).to.equal(siasCancelled);
  });

  it("Anyone can call burnBaseToken()", async function () {
    await expect(siasCancelled.connect(signer1).burnBaseToken()).to.not.reverted;
  });

  it("Should have burned all shares", async function () {        
    expect(await sia.totalSupply()).to.equal(0);
  });
});