import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule.ts";

describe("Shares", function () {
  
  let shares: Contract;
  let paymentHub: Contract;
  
  before(async function() {
    ({ shares, paymentHub } = await  connection.ignition.deploy(TestModule));

    setBalance(await signer1.getAddress(), ethers.parseEther("1"));
    await shares.connect(owner).mint(signer1, 100n);
    await shares.connect(owner).mint(signer2, 100n);
  });
  
  it("Should deploy", async function () {
    expect(await shares.getAddress()).to.exist;
  });

  it("Should get constructor params correctly", async () => {
    expect(await shares.symbol()).to.equal(TestModuleConfig.shareConfig.symbol);
    expect(await shares.name()).to.equal(TestModuleConfig.shareConfig.name);
    expect(await shares.terms()).to.equal(TestModuleConfig.shareConfig.terms);
    expect(await shares.totalShares()).to.equal(TestModuleConfig.shareConfig.totalShares);
  });

  it("Should be mintable", async () => {
    const sharesToMint = 100n;
    const oldBalance = await shares.balanceOf(signer1);
    await shares.connect(owner).mint(signer1, sharesToMint);
    const newBalance = await shares.balanceOf(signer1);
    expect(oldBalance + sharesToMint).to.equal(newBalance);
  });

  it("Should allow infinite allowance", async () => {
    // Allow PaymentHub to spend infinite shares from accounts[0]
    await shares.connect(signer1).approve(await paymentHub.getAddress(), TestModuleConfig.infiniteAllowance);

    // Get allowance before transaction
    const allowanceBefore = await shares.allowance(signer1, await paymentHub.getAddress());

    // Execute transaction. Send any number through paymentHub
    await paymentHub.connect(signer1).multiPay(await shares.getAddress(), [signer2], [1]);

    // Get allowance after transaction
    const allowanceAfter = await shares.allowance(signer1, await paymentHub.getAddress());

    // Infinite approval must not have changed
    expect(allowanceBefore).to.equal(allowanceAfter);
    
  });
});