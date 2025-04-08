import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { EtherForwarder, EtherTransferReentrancyExploiter } from "../../typechain-types";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import { getImpersonatedSigner } from "../helpers/getImpersonatedSigner";


describe("EtherForwarder", function () {
  let deployer: HardhatEthersSigner, receiver: HardhatEthersSigner;
  let exploitableMultisig: HardhatEthersSigner;  
  let etherForwarder: EtherForwarder;
  let exploiterReceiver: EtherTransferReentrancyExploiter
  
  before(async function() {
    await switchForkedNetwork("mainnet");
    [deployer, receiver] = await ethers.getSigners();
    exploitableMultisig = await getImpersonatedSigner("0x38e2B267BD38092230E04b33584191055AC5EEbC");
    etherForwarder = await hre.ethers.deployContract("EtherForwarder", []);
    exploiterReceiver = await hre.ethers.deployContract("EtherTransferReentrancyExploiter", []);
  });

  it("Should be able to call transfer to send ETH", async function () {
    const value = ethers.parseEther("0.1")
    const balanceBeforeSender = await ethers.provider.getBalance(exploitableMultisig);
    const balanceBeforeReceiver = await ethers.provider.getBalance(receiver);
    const transactionReceipt = await (await exploitableMultisig.sendTransaction({to: receiver, value: value})).wait();
    const gasSpent = transactionReceipt!.gasUsed * transactionReceipt!.gasPrice
    const balanceAfterSender = await ethers.provider.getBalance(exploitableMultisig);
    const balanceAfterReceiver = await ethers.provider.getBalance(receiver);
    
    expect(balanceAfterSender).to.equal(balanceBeforeSender - value - gasSpent);
    expect(balanceAfterReceiver).to.equal(balanceBeforeReceiver + value);
  });

  it("Should protect against malicious contracts calling back", async function () {    
    const value = ethers.parseEther("0.1")
    await expect(exploitableMultisig.sendTransaction({to: exploiterReceiver, value: value})).to.be.reverted;
  });
});