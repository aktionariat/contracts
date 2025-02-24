import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import TestModule from "../ignition/modules/TestModule";

async function deployTestModuleFixture() {
  return hre.ignition.deploy(TestModule);
}

describe("Contract Deployment", function () {
  it("Should deploy RecoveryHub", async function () {
    const { recoveryHub } = await loadFixture(deployTestModuleFixture);
    expect(await recoveryHub.getAddress()).to.not.be.null
  });

  it("Should deploy OfferFactory", async function () {
    const { offerFactory } = await loadFixture(deployTestModuleFixture);
    expect(await offerFactory.getAddress()).to.not.be.null
  });

  it("Should deploy Permit2Hub", async function () {
    const { permit2Hub } = await loadFixture(deployTestModuleFixture);
    expect(await permit2Hub.getAddress()).to.not.be.null
  });

  it("Should deploy Shares", async function () {
    const { shares } = await loadFixture(deployTestModuleFixture);
    expect(await shares.getAddress()).to.not.be.null
  });

  it("Should deploy DraggableShares", async function () {
    const { draggableShares } = await loadFixture(deployTestModuleFixture);
    expect(await draggableShares.getAddress()).to.not.be.null
  });

  it("Should deploy DraggableSharesWithPredecessor", async function () {
    const { draggableSharesWithPredecessor } = await loadFixture(deployTestModuleFixture);
    expect(await draggableSharesWithPredecessor.getAddress()).to.not.be.null
  });

  it("Should deploy DraggableSharesWithPredecessorExternal", async function () {
    const { draggableSharesWithPredecessorExternal } = await loadFixture(deployTestModuleFixture);
    expect(await draggableSharesWithPredecessorExternal.getAddress()).to.not.be.null
  });

  it("Should deploy ERC20Cancelled", async function () {
    const { erc20Cancelled } = await loadFixture(deployTestModuleFixture);
    expect(await erc20Cancelled.getAddress()).to.not.be.null
  });

  it("Should deploy PaymentHub", async function () {
    const { paymentHub } = await loadFixture(deployTestModuleFixture);
    expect(await paymentHub.getAddress()).to.not.be.null
  });
 /*
  it("Should deploy Brokerbot", async function () {
    const { brokerbot } = await loadFixture(deployTestModuleFixture);
    expect(await brokerbot.getAddress()).to.not.be.null
  });
  */

  it("Should get ZCHF", async function () {
    const { zchf } = await loadFixture(deployTestModuleFixture);
    expect(await zchf.getAddress()).to.not.be.null
  });

  it("Should get DAI", async function () {
    const { dai } = await loadFixture(deployTestModuleFixture);
    expect(await dai.getAddress()).to.not.be.null
  });

  it("Should get USDC", async function () {
    const { usdc } = await loadFixture(deployTestModuleFixture);
    expect(await usdc.getAddress()).to.not.be.null
  });
});