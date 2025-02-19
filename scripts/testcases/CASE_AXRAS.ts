import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getImpersonatedSigner } from "../helpers/getImpersonatedSigner";
import { DraggableShares, ERC20Cancelled, Shares } from "../../typechain-types";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { switchForkedNetwork } from "../helpers/switchNetwork";


describe("Test AXRAS", function () {
  let axelra1: HardhatEthersSigner, axelra2: HardhatEthersSigner, axelra3: HardhatEthersSigner;
  let shareholder1: HardhatEthersSigner, shareholder2: HardhatEthersSigner, shareholder3: HardhatEthersSigner, shareholder4: HardhatEthersSigner;

  let axra: Shares;
  let axras: DraggableShares;
  let erc20Cancelled: ERC20Cancelled;
  
  before(async function() {
    // This all need to be done on Optimism
    await switchForkedNetwork("optimism");
    
    axra = await ethers.getContractAt("Shares", "0x0Bba384812a64164FEd62c6C40d399C0ac5d99bd");
    axras = await ethers.getContractAt("DraggableShares", "0xc02b55bB2Fe3643E1955b13515396cE23B110f80");
    erc20Cancelled = await hre.ethers.deployContract("ERC20Cancelled", [await axras.getAddress()]);

    axelra1 = await getImpersonatedSigner("0x829BBBf674dbD7B8d9c8D19E8c50d219a4909D90");
    axelra2 = await getImpersonatedSigner("0x5D0F02f9D255C051f3236824dB7BdC1aE48Aad8D");
    axelra3 = await getImpersonatedSigner("0xf0a68722E3ab5124979020331B51431030708844");
    shareholder1 = await getImpersonatedSigner("0xFBCF194F2E332eb67136bE6Eb223E7386Ab5f35B");
    shareholder2 = await getImpersonatedSigner("0xbBe304607d6089ca3f987B3c42B86F07679ac5fB");
    shareholder3 = await getImpersonatedSigner("0x4BD839d4384E43b37783a9A8387645E4cF95A7fE");
    shareholder4 = await getImpersonatedSigner("0x43EaBeB1C0173294E870fa1b047db7e9afcBA35F");
    
    // Also give them some ETH
    setBalance(await axelra1.getAddress(), ethers.parseEther("1"));
    setBalance(await axelra2.getAddress(), ethers.parseEther("1"));
    setBalance(await axelra3.getAddress(), ethers.parseEther("1"));
  });

  it("Replicate start state", async function () {
    expect(await axras.balanceOf(axelra1)).to.equal(908544n);
    expect(await axras.balanceOf(axelra2)).to.equal(41418n);
    expect(await axras.balanceOf(axelra3)).to.equal(49990n);
    expect(await axras.balanceOf(shareholder1)).to.equal(40);
    expect(await axras.balanceOf(shareholder2)).to.equal(4n);
    expect(await axras.balanceOf(shareholder3)).to.equal(2n);
    expect(await axras.balanceOf(shareholder4)).to.equal(2n);
  });

  it("Send shares to ERC20Cancelled", async function () {
    await axras.connect(axelra1).transfer(await erc20Cancelled.getAddress(), await axras.balanceOf(axelra1));
    await axras.connect(axelra2).transfer(await erc20Cancelled.getAddress(), await axras.balanceOf(axelra2)); 
    await axras.connect(axelra3).transfer(await erc20Cancelled.getAddress(), await axras.balanceOf(axelra3));
    expect(await axras.balanceOf(axelra1)).to.equal(0);
    expect(await axras.balanceOf(axelra2)).to.equal(0);
    expect(await axras.balanceOf(axelra3)).to.equal(0);
    expect(await axras.balanceOf(shareholder1)).to.equal(40);
    expect(await axras.balanceOf(shareholder2)).to.equal(4);
    expect(await axras.balanceOf(shareholder3)).to.equal(2);
    expect(await axras.balanceOf(shareholder4)).to.equal(2);
  });

  it("Call burnThemAll", async function () {
    expect(await erc20Cancelled.burnThemAll()).to.not.reverted;     
  });

  it("Should have replaced wrapped with ERC20Cancelled", async function () {
    const newWrapped = await ethers.getContractAt("ERC20Cancelled", await axras.wrapped());
    expect(newWrapped).to.equal(erc20Cancelled);
  });

  it("Check balances afterwards", async function () {
    expect(await axras.balanceOf(axelra1)).to.equal(0);
    expect(await axras.balanceOf(axelra2)).to.equal(0);
    expect(await axras.balanceOf(axelra3)).to.equal(0);
    expect(await axras.balanceOf(shareholder1)).to.equal(40);
    expect(await axras.balanceOf(shareholder2)).to.equal(4);
    expect(await axras.balanceOf(shareholder3)).to.equal(2);
    expect(await axras.balanceOf(shareholder4)).to.equal(2);
  });

  it("Should have burned all shares", async function () {    
    expect(await axra.balanceOf(axelra1)).to.equal(0);
    expect(await axra.balanceOf(axelra2)).to.equal(0);
    expect(await axra.balanceOf(axelra3)).to.equal(0);
    expect(await axra.balanceOf(shareholder1)).to.equal(0);
    expect(await axra.balanceOf(shareholder2)).to.equal(0);
    expect(await axra.balanceOf(shareholder3)).to.equal(0);
    expect(await axra.balanceOf(shareholder4)).to.equal(0);
    expect(await axra.totalSupply()).to.equal(0);
  });
});