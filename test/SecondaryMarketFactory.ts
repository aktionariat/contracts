import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";


describe("SecondaryMarketFactory", function () {
  let secondaryMarketFactory: Contract;
  let allowlistDraggableShares: Contract
  let tradeReactor: Contract
  let zchf: Contract;

  async function deployTestModuleFixture() {
    return connection.ignition.deploy(TestModule);
  }

  beforeEach(async function() {
    ({ secondaryMarketFactory, zchf, allowlistDraggableShares, tradeReactor } = await connection.networkHelpers.loadFixture(deployTestModuleFixture));
  });

  it("Should be able to be deployed", async function () {
    expect(await secondaryMarketFactory.getAddress()).to.exist;
  });

  it("Should be able to deploy secondaryMarket without router", async function () {
    await expect(secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed");
  })

  it("Should be able to deploy secondaryMarket without router", async function () {
    await expect(secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, deployer)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed");
  })

  it("Should be able predict a deployment address", async function () {
    expect(await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, tradeReactor, deployer)).to.not.be.equal(ethers.ZeroAddress);
  })

  it("Should be able deploy to the predicted address - without router", async function () {
    const predictedAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress);
    await expect(secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed").withArgs(owner, predictedAddress);
  })

  it("Should be able deploy to the predicted address - with router", async function () {
    const predictedAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, tradeReactor, deployer);
    await expect(secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, deployer)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed").withArgs(owner, predictedAddress);
  })


});