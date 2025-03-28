import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getImpersonatedSigner } from "../helpers/getImpersonatedSigner";
import { DraggableShares, ERC20Cancelled, Shares } from "../../typechain-types";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import { multisig } from "../../typechain-types/contracts";

// Test detokenzation of Axelra shares

describe("Test Farmy", function () {
  let deployer: HardhatEthersSigner, signer1: HardhatEthersSigner;

  let farmyMultisig: HardhatEthersSigner;
  let eggsShareholder1: HardhatEthersSigner, eggsShareholder2: HardhatEthersSigner, eggsMarket: HardhatEthersSigner;
  let eggfsShareholder1: HardhatEthersSigner, eggfsShareholder2: HardhatEthersSigner, eggfsShareholder3: HardhatEthersSigner;

  let egg: Shares;
  let eggs: DraggableShares;
  let eggsCancelled: ERC20Cancelled;

  let eggf: Shares;
  let eggfs: DraggableShares;
  let eggfsCancelled: ERC20Cancelled;
  
  before(async function() {
    // This all need to be done on Optimism
    await switchForkedNetwork("mainnet");

    [deployer, signer1] = await ethers.getSigners();

    farmyMultisig = await getImpersonatedSigner("0x67C5770202aa3E2b0DB2e5342d97c191a0E46303");
    
    egg = await ethers.getContractAt("Shares", "0xcC3193E98DBff48ae5D460052dfbf3355afEC432");
    eggs = await ethers.getContractAt("DraggableShares", "0x1f6Db77Bf48CB29F30b84eA2AE9ffD4b07C4571e");
    eggsCancelled = await hre.ethers.deployContract("ERC20Cancelled", [await eggs.getAddress()]);
    
    eggf = await ethers.getContractAt("Shares", "0x2f4722F3b37A17E23a6e3Ab90Ab6Ff4aAEFE99d0");
    eggfs = await ethers.getContractAt("DraggableShares", "0x620BF52Fa5E97fbFb3992cab478e3272285ADfD1");
    eggfsCancelled = await hre.ethers.deployContract("ERC20Cancelled", [await eggfs.getAddress()]);

    eggsMarket = await getImpersonatedSigner("0xC41575D0CF4A630B7992c675D760939E1402151C");
    eggsShareholder1 = await getImpersonatedSigner("0x45d4261D0CBcCE68A3921f8CC43015A977A56f00");
    eggsShareholder2 = await getImpersonatedSigner("0x181EF4139b51726f76cE45a81B9F92434F2d18a8");

    eggfsShareholder1 = await getImpersonatedSigner("0x5a57dD9C623e1403AF1D810673183D89724a4e0c");
    eggfsShareholder2 = await getImpersonatedSigner("0xDb3Ff1A291bA147d254AD1CF2047947a9D5C512b");
    eggfsShareholder3 = await getImpersonatedSigner("0xD4Bec19F95a4f8ADa5dDF10f3cF9D1455F848B54");
    
    setBalance(await farmyMultisig.getAddress(), ethers.parseEther("1"));
  });

  it("Check start state", async function () {
    expect(await eggs.balanceOf(eggsMarket)).to.equal(17364n);
    expect(await eggs.balanceOf(eggsShareholder1)).to.equal(10000n);
    expect(await eggs.balanceOf(eggsShareholder2)).to.equal(10000n);
    expect(await eggfs.balanceOf(eggfsShareholder1)).to.equal(7512n);
    expect(await eggfs.balanceOf(eggfsShareholder2)).to.equal(4553n);
    expect(await eggfs.balanceOf(eggfsShareholder3)).to.equal(3787);
  });

  it("Anyone can call mintToSHA()", async function () {
    await expect(eggsCancelled.connect(signer1).mintToSHA()).to.not.reverted;
    await expect(eggfsCancelled.connect(signer1).mintToSHA()).to.not.reverted;

    expect (await eggsCancelled.balanceOf(eggs)).to.equal(await eggs.totalSupply());
    expect (await eggfsCancelled.balanceOf(eggfs)).to.equal(await eggfs.totalSupply());
  });

  it("Multisig can migrate to cancelled with additional votes", async function () {
    expect(await eggs.connect(farmyMultisig).migrateWithExternalApproval(eggsCancelled, 5000000n)).to.not.reverted;     
    expect(await eggfs.connect(farmyMultisig).migrateWithExternalApproval(eggfsCancelled, 150000n)).to.not.reverted;     
  });

  it("Should have replaced wrapped with ERC20Cancelled", async function () {
    const newWrappedEggs = await ethers.getContractAt("ERC20Cancelled", await eggs.wrapped());
    expect(newWrappedEggs).to.equal(eggsCancelled);
    const newWrappedEggfs = await ethers.getContractAt("ERC20Cancelled", await eggfs.wrapped());
    expect(newWrappedEggfs).to.equal(eggfsCancelled);
  });

  it("Anyone can call burnBaseToken()", async function () {
    await expect(eggsCancelled.connect(signer1).burnBaseToken()).to.not.reverted;
    await expect(eggfsCancelled.connect(signer1).burnBaseToken()).to.not.reverted;
  });

  it("Should have burned all shares", async function () {        
    expect(await egg.totalSupply()).to.equal(0);
    expect(await eggf.totalSupply()).to.equal(0);
  });
});