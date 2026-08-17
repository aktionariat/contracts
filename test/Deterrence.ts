import { expect } from "chai";
import { ethers, owner, signer1, signer2 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";

// Test that the deter modifier sends the entire msg.value
// to the contract owner.

async function deployShares() {
  const Shares = await ethers.getContractFactory("Shares");
  const shares = await Shares.deploy(
    "TEST",
    "Test Shares",
    "https://test.com",
    owner
  );
  await shares.waitForDeployment();
  return shares;
}

async function deploySHA(baseAddr: string) {
  const SHA = await ethers.getContractFactory("SharesUnderAgreement");
  const sha = await SHA.deploy(baseAddr, "https://sha.com", 0, owner);
  await sha.waitForDeployment();
  return sha;
}

describe("Deterrence", function () {
  it("initRecovery sends entire msg.value to owner not only the fee", async function () {
    const shares = await deployShares();

    // Mint tokens to signer1 so there is a balance to recover
    await shares.connect(owner).mint(signer1, 100n);

    // Record owner ETH balance before
    const ownerAddr = await owner.getAddress();
    const ownerBalanceBefore = await ethers.provider.getBalance(ownerAddr);

    // signer2 calls initRecovery(signer1) with 0.1 ETH, when fee is 0.01 ETH
    const payment = ethers.parseEther("0.1");
    await setBalance(await signer2.getAddress(), ethers.parseEther("1"));
    await shares
      .connect(signer2)
      ["initRecovery(address)"](signer1, { value: payment });

    // Owner should have received the msg.value 0.1 ETH
    const ownerBalanceAfter = await ethers.provider.getBalance(ownerAddr);
    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(payment);
  });

  it("initRecovery sends entire msg.value for deter(100) via offerAcquisition", async function () {
    const shares = await deployShares();
    const sha = await deploySHA(await shares.getAddress());

    // Mint and wrap some shares so totalSupply > 0
    await shares.connect(owner).mintAndWrap(signer1, sha, 100n);

    const ownerAddr = await owner.getAddress();
    const ownerBalanceBefore = await ethers.provider.getBalance(ownerAddr);

    // signer2 calls offerAcquisition, deter(100): fee = 0.01 * 100 = 1 ETH
    // Send 2 ETH
    const payment = ethers.parseEther("2");
    await setBalance(await signer2.getAddress(), ethers.parseEther("3"));

    // Dummy shares address
    await sha
      .connect(signer2)
      .offerAcquisition(shares, 0, "test", { value: payment });

    // Owner received the entire 2 ETH, not only 1 ETH
    const ownerBalanceAfter = await ethers.provider.getBalance(ownerAddr);
    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(payment);
  });
});
