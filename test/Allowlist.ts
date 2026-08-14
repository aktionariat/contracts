import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer2 } from "./TestBase.ts";

// Allowlist tests for the interplay of mintAndWrap, an admin holder burning wrapped
// shares and the free (unrestricted) tier. The key invariant under test: burning from
// an admin address must not corrupt the allowlist state of address zero, which is the
// "free" sentinel that makes new mints freely transferable.

const BASE = { symbol: "TEST", name: "Test Company Shares", terms: "https://test.com/terms" };
const AGREEMENT_TERMS = "https://test.com/agreement";
const DECIMALS = 0;

const RECOVERY_DELAY = 184n * 24n * 60n * 60n; // 184 days

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
  const s = await Shares.deploy(BASE.symbol, BASE.name, BASE.terms, owner);
  await s.waitForDeployment();
  return s as unknown as Contract;
}

async function deploySharesUnderAgreement(base: Contract): Promise<Contract> {
  const SUA = await ethers.getContractFactory("contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement");
  const sua = await SUA.deploy(base, AGREEMENT_TERMS, DECIMALS, owner);
  await sua.waitForDeployment();
  return sua as unknown as Contract;
}

describe("Allowlist (ERC20Allowlistable)", function () {
  it("keeps address zero free and new mints in the free tier after an admin burns", async () => {
    const shares = await deployShares();
    const sha = await deploySharesUnderAgreement(shares);

    // Mint base shares and wrap them into SHA for signer1 in one owner call.
    await shares.connect(owner).mintAndWrap(signer1, sha, 100n);
    expect(await sha.balanceOf(signer1)).to.equal(100n);

    // Address zero is the "free" allowance sentinel before any burn.
    expect(await sha.isAllowed(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isAdmin(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isRestricted(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.defaultType()).to.equal(await sha.TYPE_FREE());

    // Promote the wrapped-share holder to admin.
    await sha.connect(owner)["setType(address,uint8)"](signer1, await sha.TYPE_ADMIN());
    expect(await sha.isAdmin(signer1)).to.equal(true);

    // Owner time-locked-burns part of the admin holder's SHA balance.
    await sha.connect(owner).initBurn(signer1);
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await sha.connect(owner)["burn(address,uint256)"](signer1, 40n);
    expect(await sha.balanceOf(signer1)).to.equal(60n);

    // Address zero must still be a "free" allowance address after the burn.
    expect(await sha.isAllowed(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isAdmin(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isRestricted(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.defaultType()).to.equal(await sha.TYPE_FREE());

    // New shares can still be minted and wrapped to a fresh signer, who lands in
    // the "free" tier (not auto-allowlisted).
    await shares.connect(owner).mintAndWrap(signer2, sha, 25n);
    expect(await sha.balanceOf(signer2)).to.equal(25n);
    expect(await sha.isAllowed(signer2)).to.equal(false);
    expect(await sha.isAdmin(signer2)).to.equal(false);
    expect(await sha.isRestricted(signer2)).to.equal(false);
  });
});
