import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import { deployFixture } from "./Fixtures.ts";


describe("SecondaryMarketFactory", function () {
  let secondaryMarketFactory: Contract;
  let sharesUnderAgreement: Contract  // SharesUnderAgreement, the traded token (replaces old allowlistDraggableShares)
  let zchf: Contract;

  beforeEach(async function() {
    ({ secondaryMarketFactory, zchf, sharesUnderAgreement } = await connection.networkHelpers.loadFixture(deployFixture));
  });

  it("Should be able to be deployed", async function () {
    expect(await secondaryMarketFactory.getAddress()).to.exist;
  });

  it("Should be able to deploy secondaryMarket without router", async function () {
    await expect(secondaryMarketFactory.deploy(owner, zchf, sharesUnderAgreement, ethers.ZeroAddress)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed");
  })

  it("Should be able to deploy secondaryMarket with router", async function () {
    await expect(secondaryMarketFactory.deploy(owner, zchf, sharesUnderAgreement, deployer)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed");
  })

  it("Should be able predict a deployment address", async function () {
    expect(await secondaryMarketFactory.predict(owner, zchf, sharesUnderAgreement, deployer)).to.not.be.equal(ethers.ZeroAddress);
  })

  it("Should be able deploy to the predicted address - without router", async function () {
    const predictedAddress = await secondaryMarketFactory.predict(owner, zchf, sharesUnderAgreement, ethers.ZeroAddress);
    await expect(secondaryMarketFactory.deploy(owner, zchf, sharesUnderAgreement, ethers.ZeroAddress)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed").withArgs(owner, predictedAddress);
  })

  it("Should be able deploy to the predicted address - with router", async function () {
    const predictedAddress = await secondaryMarketFactory.predict(owner, zchf, sharesUnderAgreement, deployer);
    await expect(secondaryMarketFactory.deploy(owner, zchf, sharesUnderAgreement, deployer)).to.emit(secondaryMarketFactory, "SecondaryMarketDeployed").withArgs(owner, predictedAddress);
  })


});