import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule.ts";

describe("AllowlistShares", function () {
  let allowlistShares: Contract;
  
  before(async function() {
    ({ allowlistShares } = await connection.ignition.deploy(TestModule));
    
    setBalance(await signer1.getAddress(), ethers.parseEther("1"));
    setBalance(await signer2.getAddress(), ethers.parseEther("1"));
    setBalance(await signer3.getAddress(), ethers.parseEther("1"));
    setBalance(await signer4.getAddress(), ethers.parseEther("1"));
    setBalance(await signer5.getAddress(), ethers.parseEther("1"));
    await allowlistShares.connect(owner).mint(signer1, 100n);
    await allowlistShares.connect(owner).mint(signer2, 100n);
    await allowlistShares.connect(owner).mint(signer3, 100n);
    await allowlistShares.connect(owner).mint(signer4, 100n);
    await allowlistShares.connect(owner).mint(signer5, 100n);
  });

  it("Should deploy", async function () {
    expect(await allowlistShares.getAddress()).to.exist;
  });

  it("Should get constructor params correctly", async () => {
    expect(await allowlistShares.symbol()).to.equal(TestModuleConfig.allowlistShareConfig.symbol);
    expect(await allowlistShares.name()).to.equal(TestModuleConfig.allowlistShareConfig.name);
    expect(await allowlistShares.terms()).to.equal(TestModuleConfig.allowlistShareConfig.terms);
    expect(await allowlistShares.totalShares()).to.equal(TestModuleConfig.allowlistShareConfig.totalShares);
  });

  it("Should be mintable", async () => {
    const sharesToMint = 100n;
    const oldBalance = await allowlistShares.balanceOf(signer1);
    await allowlistShares.connect(owner).mint(signer1, sharesToMint);
    const newBalance = await allowlistShares.balanceOf(signer1);
    expect(oldBalance + sharesToMint).to.equal(newBalance);
  });

  it("Accounts should not have any status by default", async () => {
    ({ allowlistShares } = await connection.ignition.deploy(TestModule));
    expect(await allowlistShares.isAllowed(signer1)).to.equal(false)
    expect(await allowlistShares.isRestricted(signer1)).to.equal(false)
    expect(await allowlistShares.isAdmin(signer1)).to.equal(false)
  });

  it("Should allow setting type by owner", async () => {
    ({ allowlistShares } = await connection.ignition.deploy(TestModule));
    expect(await allowlistShares.isAllowed(signer1)).to.equal(false)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 1)
    expect(await allowlistShares.isAllowed(signer1)).to.equal(true)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 2)
    expect(await allowlistShares.isAllowed(signer1)).to.equal(false)
    expect(await allowlistShares.isRestricted(signer1)).to.equal(true)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 4)
    expect(await allowlistShares.isRestricted(signer1)).to.equal(false)
    expect(await allowlistShares.isAdmin(signer1)).to.equal(true)
  });

  it("Should not allow setting type by non-owner", async () => {
    ({ allowlistShares } = await connection.ignition.deploy(TestModule));
    await expect(allowlistShares.connect(signer1)["setType(address,uint8)"](signer1, 4)).to.revert(ethers);
  });

  it("Should implement restrictions ruleset correctly", async () => {
    ({ allowlistShares } = await connection.ignition.deploy(TestModule));
    await allowlistShares.connect(owner).mint(signer1, 100n);
    await allowlistShares.connect(owner).mint(signer2, 100n);
    await allowlistShares.connect(owner).mint(signer3, 100n);
    await allowlistShares.connect(owner).mint(signer4, 100n);
    await allowlistShares.connect(owner).mint(signer5, 100n);

    // Set signers to different types. 
    // signer2 free, signer3 allowed, signer4 restricted, signer5 admin
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer2, 0)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer3, 1)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer4, 2)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer5, 4)

    // signer1 free
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 0)
    await expect(allowlistShares.connect(signer1).transfer(signer2, 1)).to.not.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer3, 1)).to.not.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer4, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer5, 1)).to.not.revert(ethers)
    
    // signer1 allowed
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 1)
    await expect(allowlistShares.connect(signer1).transfer(signer2, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer3, 1)).to.not.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer4, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer5, 1)).to.not.revert(ethers)
    
    // signer1 restricted
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 2)
    await expect(allowlistShares.connect(signer1).transfer(signer2, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer3, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer4, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer5, 1)).to.not.revert(ethers)
    
    // signer1 admin
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 4)
    await expect(allowlistShares.connect(signer1).transfer(signer2, 1)).to.not.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer3, 1)).to.not.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer4, 1)).to.revert(ethers)
    await expect(allowlistShares.connect(signer1).transfer(signer5, 1)).to.not.revert(ethers)
  });

  it("Should let ADMIN convert FREE to ALLOWED upon transfer", async () => {
    ({ allowlistShares } = await connection.ignition.deploy(TestModule));
    await allowlistShares.connect(owner).mint(signer1, 100n);

    await allowlistShares.connect(owner)["setType(address,uint8)"](signer1, 4)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer2, 0)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer3, 1)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer4, 2)
    await allowlistShares.connect(owner)["setType(address,uint8)"](signer5, 4)

    await allowlistShares.connect(signer1).transfer(signer2, 1)
    expect(await allowlistShares.isAllowed(signer2)).to.equal(true)

    await allowlistShares.connect(signer1).transfer(signer3, 1)
    expect(await allowlistShares.isAllowed(signer3)).to.equal(true)

    await allowlistShares.connect(signer1).transfer(signer5, 1)
    expect(await allowlistShares.isAllowed(signer5)).to.equal(false)
    expect(await allowlistShares.isAdmin(signer5)).to.equal(true)
  });
});