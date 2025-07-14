import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import { Contract } from "ethers";
import MultiSigWalletMasterUpdateModule0725 from "../../ignition/modules/aktionariat/MultiSigWalletMasterUpdate_0725";

async function deployWalletMasterUpdateFixture() {
  await switchForkedNetwork("mainnet");
  return hre.ignition.deploy(MultiSigWalletMasterUpdateModule0725, { strategy: "create2" });
}

describe("Aktionariat Wallet Master Update - 07.25", function () {
  let deployer: HardhatEthersSigner, signer1: HardhatEthersSigner;
  
  let argumentSource: Contract;
  let multiSigWalletMaster: Contract;
  
  before(async function() {
    [deployer, signer1] = await ethers.getSigners();
    ({ argumentSource, multiSigWalletMaster } = await deployWalletMasterUpdateFixture());
  });

  it("Should have deployed correctly", async function () {
    expect(await argumentSource.router()).to.equal("0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D");
    expect(await multiSigWalletMaster.signers([deployer.address])).to.equal(1);
  });
});