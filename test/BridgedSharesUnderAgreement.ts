import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer2, signer3 } from "./TestBase.ts";

// contracts/shares/sha/BridgedSharesUnderAgreement.sol: the other-chain twin of the wrapper. Only the
// CCIP pool mints and burns; the owner keeps the allowlist and the time-locked recovery and burn.

const RECOVERY_DELAY = 184n * 24n * 60n * 60n;
const TYPE_ALLOWED = 1n;

describe("BridgedSharesUnderAgreement", function () {
  let token: Contract;
  const pool = signer3; // stands in for the BurnMintTokenPool

  async function setup() {
    const Token = await ethers.getContractFactory("BridgedSharesUnderAgreement");
    const t = await Token.deploy("ABCS", "ABC Company Shares SHA", "https://abc.test/agreement", owner);
    await t.waitForDeployment();
    await t.connect(owner).setPool(pool);
    return { token: t as unknown as Contract };
  }

  beforeEach(async () => {
    ({ token } = await connection.networkHelpers.loadFixture(setup));
  });

  it("has version 6, no decimals and the terms", async () => {
    expect(await token.VERSION()).to.equal(6n);
    expect(await token.decimals()).to.equal(0n);
    expect(await token.terms()).to.equal("https://abc.test/agreement");
  });

  it("only the pool mints and burns, not even the owner", async () => {
    await expect(token.connect(owner).mint(signer1, 10n)).to.be.revertedWithCustomError(token, "NotPool").withArgs(owner.address);
    await token.connect(pool).mint(signer1, 10n);
    expect(await token.totalSupply()).to.equal(10n);
    // bridging out: the router moves the tokens to the pool, the pool burns its own balance
    await token.connect(signer1).transfer(pool, 4n);
    await expect(token.connect(owner)["burn(uint256)"](4n)).to.be.revertedWithCustomError(token, "NotPool").withArgs(owner.address);
    await token.connect(pool)["burn(uint256)"](4n);
    expect(await token.totalSupply()).to.equal(6n);
  });

  it("setPool is owner-only and emits", async () => {
    await expect(token.connect(signer1).setPool(signer1)).to.be.revertedWithCustomError(token, "Ownable_NotOwner").withArgs(signer1.address);
    await expect(token.connect(owner).setPool(signer1)).to.emit(token, "PoolChanged").withArgs(pool.address, signer1.address);
    await expect(token.connect(pool).mint(signer1, 1n)).to.be.revertedWithCustomError(token, "NotPool").withArgs(pool.address);
  });

  it("lets the owner burn a lost address only through the time-locked recovery", async () => {
    await token.connect(pool).mint(signer1, 10n);
    await expect(token.connect(owner)["burn(address,uint256)"](signer1, 10n)).to.be.revertedWithCustomError(token, "RecoveryNotFound").withArgs(signer1.address);
    await token.connect(owner).initBurn(signer1);
    await expect(token.connect(owner)["burn(address)"](signer1)).to.be.revertedWithCustomError(token, "RecoveryTooEarly");
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await expect(token.connect(owner)["burn(address)"](signer1)).to.emit(token, "Burned").withArgs(signer1.address, 10n);
    expect(await token.totalSupply()).to.equal(0n);
  });

  it("recovers a lost address to the owner even when frozen", async () => {
    await token.connect(pool).mint(signer1, 10n);
    await token.connect(owner).setApplicable(true);
    await token.connect(owner).freeze(signer1);
    await token.connect(owner)["initRecovery(address,address)"](signer1, owner);
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await token.recover(signer1);
    expect(await token.balanceOf(owner)).to.equal(10n);
  });

  describe("restricted regime", function () {
    beforeEach(async () => {
      await token.connect(owner).setApplicable(true);
      // holders send to the pool to bridge out, so the pool must be allowlisted like every other receiver
      await token.connect(owner)["setType(address,uint8)"](pool, TYPE_ALLOWED);
    });

    it("blocks bridging out through an untyped pool", async () => {
      await token.connect(pool).mint(signer1, 10n);
      await token.connect(owner)["setType(address,uint8)"](pool, 0n);
      await expect(token.connect(signer1).transfer(pool, 3n)).to.be.revertedWithCustomError(token, "Allowlist_ReceiverNotAllowlisted").withArgs(pool.address);
    });

    it("stamps the receiver of a bridged-in mint as allowed", async () => {
      await token.connect(pool).mint(signer1, 10n);
      expect(await token.isAllowed(signer1)).to.equal(true);
      expect(await token.defaultType()).to.equal(TYPE_ALLOWED);
    });

    it("refuses to mint to a frozen receiver until unfrozen", async () => {
      await token.connect(owner).freeze(signer2);
      await expect(token.connect(pool).mint(signer2, 5n)).to.be.revertedWithCustomError(token, "Allowlist_ReceiverIsForbidden").withArgs(signer2.address);
      await token.connect(owner).unfreeze(signer2);
      await token.connect(pool).mint(signer2, 5n);
      expect(await token.balanceOf(signer2)).to.equal(5n);
    });

    it("lets an allowed holder bridge out and blocks a frozen one", async () => {
      await token.connect(pool).mint(signer1, 10n);
      await token.connect(signer1).transfer(pool, 3n);
      await token.connect(pool)["burn(uint256)"](3n);
      await token.connect(owner).freeze(signer1);
      await expect(token.connect(signer1).transfer(pool, 3n)).to.be.revertedWithCustomError(token, "Allowlist_SenderIsForbidden").withArgs(signer1.address);
    });
  });
});
