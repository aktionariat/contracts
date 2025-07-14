import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import { Contract } from "ethers";
import MultichainWalletRolloutModule0725 from "../../ignition/modules/aktionariat/MultichainWalletRollout";

async function deployMultichainWalletRolloutFixture() {
  await switchForkedNetwork("mainnet");
  return hre.ignition.deploy(MultichainWalletRolloutModule0725, { strategy: "create2" });
}

describe("Multichain Rollout - 07.25", function () {
  let deployer: HardhatEthersSigner, signer1: HardhatEthersSigner;
  
  let rollout: Contract;
  
  before(async function() {
    [deployer, signer1] = await ethers.getSigners();
    ({ rollout } = await deployMultichainWalletRolloutFixture());
  });

  it("Should have deployed correctly", async function () {
    console.log("Rollout address:", await rollout.getAddress());
  });
});