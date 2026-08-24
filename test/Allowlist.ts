import { expect } from "chai";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer2,
  signer3,
} from "./TestBase.ts";
import {
  IERC20,
  Shares,
  SharesUnderAgreement,
} from "../types/ethers-contracts/index.ts";

// Allowlist tests for addresses policies
// To be tested the always-free allowlist of the zero address and contracts.
// Which implies that minting and third party transfers to contracts do not
// modify the capability of transfering tokens between involved, free and allowed
// addresses

const SHARES = {
  symbol: "TEST",
  name: "Test Company Shares",
  terms: "https://test.com/terms",
};
const SHA_TERMS = "https://test.com/agreement";
const DECIMALS = 0;

// 184 days
const RECOVERY_DELAY = 184n * 24n * 60n * 60n;

async function deployShares(): Promise<Shares> {
  const Shares = await ethers.getContractFactory("Shares");
  const s = await Shares.deploy(
    SHARES.symbol,
    SHARES.name,
    SHARES.terms,
    owner
  );
  await s.waitForDeployment();
  return s;
}

async function deploySharesUnderAgreement(
  base: IERC20
): Promise<SharesUnderAgreement> {
  const SUA = await ethers.getContractFactory("SharesUnderAgreement");
  const sua = await SUA.deploy(base, SHA_TERMS, DECIMALS, owner);
  await sua.waitForDeployment();
  return sua;
}

describe("Allowlist (ERC20Allowlistable)", function () {
  it("keeps address zero free and new mints in the free tier after an admin burns", async () => {
    const shares = await deployShares();
    const sha = await deploySharesUnderAgreement(shares);

    // Mint base shares and wrap them into SHA for signer1 in one owner call.
    await shares.connect(owner).mintAndWrap(signer1, sha, 100n);
    expect(await sha.balanceOf(signer1)).to.equal(100n);

    // Address zero is the "free" allowlist before any burn.
    expect(await sha.isAllowed(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isAdmin(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.isRestricted(ethers.ZeroAddress)).to.equal(false);
    expect(await sha.defaultType()).to.equal(await sha.TYPE_FREE());

    // Promote the SHA holder to admin.
    await sha
      .connect(owner)
      ["setType(address,uint8)"](signer1, await sha.TYPE_ADMIN());
    expect(await sha.isAdmin(signer1)).to.equal(true);

    // Burn part of the admin holder's SHA balance.
    await sha.connect(owner).initBurn(signer1);
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await sha.connect(owner)["burn(address,uint256)"](signer1, 40n);
    expect(await sha.balanceOf(signer1)).to.equal(60n);

    // Address zero must still be a "free" allowlist address after the burn.
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

    // Extra check: admin transfer to any EOA does turn him into allowed
    await sha.connect(signer1).transfer(signer3, 10n);
    expect(await sha.isAllowed(signer3)).to.equal(true);
  });
});
