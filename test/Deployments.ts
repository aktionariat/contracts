import { Contract } from "ethers";
import { expect } from "chai";
import { connection } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";


describe("Contract Deployment", function () {
  let recoveryHub: Contract;
  let offerFactory: Contract;
  let permit2Hub: Contract;
  let shares: Contract;
  let draggableShares: Contract;
  let draggableSharesWithPredecessor: Contract;
  let draggableSharesWithPredecessorExternal: Contract;
  let erc20Cancelled: Contract;
  let paymentHub: Contract;
  let zchf: Contract;
  let dai: Contract;
  let usdc: Contract;

  before(async function() {
    ({ 
      recoveryHub, 
      offerFactory, 
      permit2Hub, 
      shares, 
      draggableShares, 
      draggableSharesWithPredecessor, 
      draggableSharesWithPredecessorExternal, 
      erc20Cancelled,
      paymentHub,
      zchf,
      dai,
      usdc
    } = await connection.ignition.deploy(TestModule));
  });

  it("Should deploy RecoveryHub", async function () {
    expect(await recoveryHub.getAddress()).to.not.be.null
  });

  it("Should deploy OfferFactory", async function () {
    expect(await offerFactory.getAddress()).to.not.be.null
  });

  it("Should deploy Permit2Hub", async function () {
    expect(await permit2Hub.getAddress()).to.not.be.null
  });

  it("Should deploy Shares", async function () {
    expect(await shares.getAddress()).to.not.be.null
  });

  it("Should deploy DraggableShares", async function () {
    expect(await draggableShares.getAddress()).to.not.be.null
  });

  it("Should deploy DraggableSharesWithPredecessor", async function () {
    expect(await draggableSharesWithPredecessor.getAddress()).to.not.be.null
  });

  it("Should deploy DraggableSharesWithPredecessorExternal", async function () {
    expect(await draggableSharesWithPredecessorExternal.getAddress()).to.not.be.null
  });

  it("Should deploy ERC20Cancelled", async function () {
    expect(await erc20Cancelled.getAddress()).to.not.be.null
  });

  it("Should deploy PaymentHub", async function () {
    expect(await paymentHub.getAddress()).to.not.be.null
  });

  it("Should get ZCHF", async function () {
    expect(await zchf.getAddress()).to.not.be.null
  });

  it("Should get DAI", async function () {
    expect(await dai.getAddress()).to.not.be.null
  });

  it("Should get USDC", async function () {
    expect(await usdc.getAddress()).to.not.be.null
  });
});