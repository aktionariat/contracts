import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import AktionariatFactoryUpdate0525Module from "../../ignition/modules/aktionariat/AktionariatFactoryUpdate_0525";
import { Contract } from "ethers";

async function deployAktionariatFactoryUpdateFixture() {
  await switchForkedNetwork("mainnet");
  return hre.ignition.deploy(AktionariatFactoryUpdate0525Module, { strategy: "create2" });
}

describe("Aktionariat Factories Update - 05.25", function () {
  let deployer: HardhatEthersSigner, signer1: HardhatEthersSigner;
  
  let factoryManager: Contract;
  let allowlistDraggableFactory: Contract;
  let tokenFactory: Contract;
  let aktionariatFactory: Contract;
  
  before(async function() {
    [deployer, signer1] = await ethers.getSigners();
    ({ factoryManager, allowlistDraggableFactory, tokenFactory, aktionariatFactory } = await deployAktionariatFactoryUpdateFixture());
  });

  it("Should have correct owners", async function () {
    expect(await allowlistDraggableFactory.owner()).to.equal(deployer.address);
    expect(await tokenFactory.owner()).to.equal(deployer.address);
    expect(await factoryManager.owner()).to.equal(deployer.address);
    expect(await aktionariatFactory.owner()).to.equal(deployer.address);
  });

  it("Aktionariat Factory should have correct links", async function () {    
    expect(await aktionariatFactory.brokerbotFactory()).to.equal("0xfAe70dEBb64a7176aaA41D1d7fEAfc4CCA4a5107");
    expect(await aktionariatFactory.tokenFactory()).to.equal(await tokenFactory.getAddress());
    expect(await aktionariatFactory.manager()).to.equal(await factoryManager.getAddress());
  });

  it("Token Factory should have correct links", async function () {    
    expect(await tokenFactory.manager()).to.equal(await factoryManager.getAddress());
    expect(await tokenFactory.allowlistDraggableFactory()).to.equal(await allowlistDraggableFactory.getAddress());
  });
});