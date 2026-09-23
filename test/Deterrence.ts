import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, owner, signer1, signer2 } from "./TestBase.ts";
import { deployFixture, mintAndWrap } from "./Fixtures.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";

// The deter modifier in contracts/utils/DeterrenceFee.sol: non-owners pay at least the fee,
// everything sent is forwarded to the owner, and nothing ever stays in the token contract.

const FEE = ethers.parseEther("0.01");

describe("Deterrence (DeterrenceFee)", function () {
  let shares: Contract;
  let sua: Contract;
  let ownerAddr: string;

  beforeEach(async () => {
    ({ shares, sharesUnderAgreement: sua } = await deployFixture());
    ownerAddr = await owner.getAddress();
    await shares.connect(owner).mint(signer1, 100n);
    await setBalance(await signer2.getAddress(), ethers.parseEther("10"));
  });

  it("forwards the entire msg.value to the owner on initRecovery, not only the fee", async () => {
    const payment = ethers.parseEther("0.1");
    const before = await ethers.provider.getBalance(ownerAddr);
    await expect(shares.connect(signer2)["initRecovery(address)"](signer1, { value: payment }))
      .to.emit(shares, "DeterrenceFeePaid").withArgs(signer2, payment);
    expect((await ethers.provider.getBalance(ownerAddr)) - before).to.equal(payment);
    expect(await ethers.provider.getBalance(shares)).to.equal(0n);
  });

  it("forwards the entire msg.value to the owner on offerAcquisition (deter(100))", async () => {
    await mintAndWrap(shares, sua, await signer1.getAddress(), 100n);
    const payment = ethers.parseEther("2");
    const before = await ethers.provider.getBalance(ownerAddr);
    await sua.connect(signer2).offerAcquisition(shares, 0n, "test", { value: payment });
    expect((await ethers.provider.getBalance(ownerAddr)) - before).to.equal(payment);
    expect(await ethers.provider.getBalance(sua)).to.equal(0n);
  });

  it("rejects a non-owner paying less than the fee", async () => {
    await expect(shares.connect(signer2)["initRecovery(address)"](signer1, { value: FEE - 1n }))
      .to.be.revertedWithCustomError(shares, "FeeMissing").withArgs(FEE, FEE - 1n);
  });

  it("lets the owner call without paying", async () => {
    await shares.connect(owner)["initRecovery(address)"](signer1);
    expect(await ethers.provider.getBalance(shares)).to.equal(0n);
  });

  it("does not strand ETH the owner sends by mistake", async () => {
    await shares.connect(owner)["initRecovery(address)"](signer1, { value: FEE });
    expect(await ethers.provider.getBalance(shares)).to.equal(0n);
  });

  it("reverts when the owner cannot receive ETH", async () => {
    // a Shares contract has no receive/fallback, so use one as the owner of another
    const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
    const orphan = await Shares.deploy("ORPH", "Orphan Shares", "https://test.com/terms", shares);
    await orphan.waitForDeployment();
    await expect(orphan.connect(signer2)["initRecovery(address)"](signer1, { value: FEE }))
      .to.be.revertedWithCustomError(orphan, "UnableToPayDeterrenceFee").withArgs(shares);
  });
});
