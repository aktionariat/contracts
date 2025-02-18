import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule from "../ignition/modules/TestModule";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("Brokerbot", function () {
  it("Brokerbot - Should init with PaymentHub correctly", async function () {
    const { brokerbot, paymentHub } = await loadFixture(deployTestModuleFixture);
    expect(await brokerbot.paymenthub()).to.be.equal(paymentHub);
  });

  it("Brokerbot - Should be able to change PaymentHub", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    let owner = await brokerbot.owner()
    let ownerSigner = await ethers.getSigner(owner);
    let dummyAddress = "0x0000000000000000000000000000000000012345"
    await brokerbot.connect(ownerSigner).setPaymentHub(dummyAddress)
    expect(await brokerbot.paymenthub()).to.be.equal(dummyAddress);
  });

  it("Brokerbot - Should not be able to change PaymentHub from non-owner", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    let dummyAddress = "0x0000000000000000000000000000000000012345"
    expect(brokerbot.setPaymentHub(dummyAddress)).to.be.reverted
  });
});