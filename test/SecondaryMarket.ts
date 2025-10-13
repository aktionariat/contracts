import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";
import { SecondaryMarket } from "../types/ethers-contracts/index.ts";


describe("SecondaryMarket", function () {
  let secondaryMarketFactory: Contract;
  let secondaryMarket: SecondaryMarket;
  let secondaryMarketWithRouter: SecondaryMarket;
  let allowlistDraggableShares: Contract
  let zchf: Contract;
  const router = signer5; // Use an existing signer as router

  async function deployTestModuleFixture() {
    return connection.ignition.deploy(TestModule);
  }

  before(async function() {
    ({ secondaryMarketFactory, zchf, allowlistDraggableShares } = await connection.networkHelpers.loadFixture(deployTestModuleFixture));
    const secondaryMarketAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, ethers.ZeroAddress);
    await secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, ethers.ZeroAddress);
    secondaryMarket = await ethers.getContractAt("SecondaryMarket", secondaryMarketAddress);
    
    const secondaryMarketWithRouterAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, router);
    await secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, router);
    secondaryMarketWithRouter = await ethers.getContractAt("SecondaryMarket", secondaryMarketWithRouterAddress);
  });

  it("Deploy with and without router", async function () {
    expect(await secondaryMarket.getAddress()).to.not.equal(ethers.ZeroAddress);
    expect(await secondaryMarketWithRouter.getAddress()).to.not.equal(ethers.ZeroAddress);
  });

  it("Set initial router correctly", async function () {
    expect(await secondaryMarket.router()).to.equal(ethers.ZeroAddress);
    expect(await secondaryMarketWithRouter.router()).to.equal(router);
  });


});