import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer2, signer3, signer4 } from "./TestBase.ts";
import { setBalance, setZCHFBalance } from "../scripts/helpers/setBalance.ts";
import { ZCHF_ADDRESS } from "./Fixtures.ts";

// Tests for contracts/shares/sha/Wrapping.sol: the binding state of the wrapper and the
// assisted unwrap. The issuer can propose to complete the unwrap for a holder once the
// contract is no longer binding; the holder (or the issuer) can cancel during the delay,
// anyone can execute afterwards. The holder always receives their full balance at their
// own address. Self-contained apart from the forked ZCHF used as drag-along currency.

const BASE = { symbol: "TEST", name: "Test Company Shares", terms: "https://test.com/terms" };
const AGREEMENT_TERMS = "https://test.com/agreement";

const MIGRATION_DELAY = 20n * 24n * 60n * 60n;
const UNWRAP_DELAY = 20n * 24n * 60n * 60n;
const DRAG_DELAY = 20n * 24n * 60n * 60n;
const RECOVERY_DELAY = 184n * 24n * 60n * 60n;
const DRAG_FEE = ethers.parseEther("1");

async function deployShares(ownerSigner: any = owner): Promise<Contract> {
  const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
  const s = await Shares.deploy(BASE.symbol, BASE.name, BASE.terms, ownerSigner);
  await s.waitForDeployment();
  return s as unknown as Contract;
}

async function deploySUA(base: Contract): Promise<Contract> {
  const SUA = await ethers.getContractFactory("contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement");
  const sua = await SUA.deploy(base, AGREEMENT_TERMS, owner);
  await sua.waitForDeployment();
  return sua as unknown as Contract;
}

async function terminate(sua: Contract) {
  await sua.connect(owner).proposeTermination();
  await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);
  await sua.connect(owner).executeMigration();
  expect(await sua.binding()).to.equal(false);
}

describe("Wrapping (sha/Wrapping.sol)", function () {
  let base: Contract;
  let sua: Contract;

  beforeEach(async () => {
    base = await deployShares();
    sua = await deploySUA(base);
    await base.connect(owner).mintAndWrap(signer1, sua, 60n);
    await base.connect(owner).mintAndWrap(signer2, sua, 40n);
  });

  describe("while binding", function () {
    it("exposes the delay constant and no proposals", async () => {
      expect(await sua.UNWRAP_PROPOSAL_DELAY()).to.equal(UNWRAP_DELAY);
      expect(await sua.unwrapProposals(signer1)).to.equal(0n);
    });

    it("refuses to propose an unwrap", async () => {
      await expect(sua.connect(owner)["proposeUnwrap(address)"](signer1))
        .to.be.revertedWithCustomError(sua, "ContractBinding");
    });

    it("refuses to unwrap", async () => {
      await expect(sua.connect(signer1).unwrap(10n)).to.be.revertedWithCustomError(sua, "ContractBinding");
    });
  });

  describe("after termination", function () {
    beforeEach(async () => {
      await terminate(sua);
    });

    it("voluntary unwrap returns the base and emits Unwrapped", async () => {
      await expect(sua.connect(signer1).unwrap(60n))
        .to.emit(sua, "Unwrapped").withArgs(signer1.address, 60n, 60n);
      expect(await base.balanceOf(signer1)).to.equal(60n);
      expect(await sua.balanceOf(signer1)).to.equal(0n);
    });

    it("only the owner can propose", async () => {
      await expect(sua.connect(signer2)["proposeUnwrap(address)"](signer1))
        .to.be.revertedWithCustomError(sua, "Ownable_NotOwner");
    });

    it("records a proposal and executes it after the delay, by anyone, to the holder's own address", async () => {
      await expect(sua.connect(owner)["proposeUnwrap(address)"](signer1))
        .to.emit(sua, "UnwrapProposed").withArgs(signer1.address);
      const proposedAt = await sua.unwrapProposals(signer1);
      expect(proposedAt).to.be.greaterThan(0n);

      await expect(sua.connect(signer3).executeUnwrap(signer1))
        .to.be.revertedWithCustomError(sua, "UnwrapTooEarly").withArgs(proposedAt + UNWRAP_DELAY, (v: bigint) => v < proposedAt + UNWRAP_DELAY);

      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.connect(signer3).executeUnwrap(signer1))
        .to.emit(sua, "Unwrapped").withArgs(signer1.address, 60n, 60n);

      expect(await base.balanceOf(signer1)).to.equal(60n);
      expect(await base.balanceOf(signer3)).to.equal(0n);
      expect(await sua.balanceOf(signer1)).to.equal(0n);
      expect(await sua.unwrapProposals(signer1)).to.equal(0n);
      // the other holder is untouched
      expect(await sua.balanceOf(signer2)).to.equal(40n);
    });

    it("rejects proposals for empty addresses and duplicates", async () => {
      await expect(sua.connect(owner)["proposeUnwrap(address)"](signer3))
        .to.be.revertedWithCustomError(sua, "NothingToUnwrap").withArgs(signer3.address);
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await expect(sua.connect(owner)["proposeUnwrap(address)"](signer1))
        .to.be.revertedWithCustomError(sua, "UnwrapPending").withArgs(signer1.address);
    });

    it("proposes in batch", async () => {
      await sua.connect(owner)["proposeUnwrap(address[])"]([signer1.address, signer2.address]);
      expect(await sua.unwrapProposals(signer1)).to.be.greaterThan(0n);
      expect(await sua.unwrapProposals(signer2)).to.be.greaterThan(0n);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await sua.executeUnwrap(signer1);
      await sua.executeUnwrap(signer2);
      expect(await base.balanceOf(signer1)).to.equal(60n);
      expect(await base.balanceOf(signer2)).to.equal(40n);
      expect(await sua.totalSupply()).to.equal(0n);
    });

    it("lets the holder object", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await expect(sua.connect(signer1)["cancelUnwrap()"]())
        .to.emit(sua, "UnwrapProposalCancelled").withArgs(signer1.address, signer1.address);
      expect(await sua.unwrapProposals(signer1)).to.equal(0n);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer1))
        .to.be.revertedWithCustomError(sua, "UnwrapNotFound").withArgs(signer1.address);
      expect(await sua.balanceOf(signer1)).to.equal(60n);
    });

    it("lets the owner cancel, and nobody else", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await expect(sua.connect(signer2)["cancelUnwrap(address)"](signer1))
        .to.be.revertedWithCustomError(sua, "Ownable_NotOwner");
      await expect(sua.connect(owner)["cancelUnwrap(address)"](signer1))
        .to.emit(sua, "UnwrapProposalCancelled").withArgs(owner.address, signer1.address);
      expect(await sua.unwrapProposals(signer1)).to.equal(0n);
    });

    it("cancelling without a proposal reverts", async () => {
      await expect(sua.connect(signer1)["cancelUnwrap()"]())
        .to.be.revertedWithCustomError(sua, "UnwrapNotFound").withArgs(signer1.address);
    });

    it("a voluntary unwrap cancels the pending proposal", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      const tx = sua.connect(signer1).unwrap(10n); // partial is enough
      await expect(tx).to.emit(sua, "UnwrapProposalCancelled").withArgs(signer1.address, signer1.address);
      await expect(tx).to.emit(sua, "Unwrapped").withArgs(signer1.address, 10n, 10n);
      expect(await sua.unwrapProposals(signer1)).to.equal(0n);
      expect(await sua.balanceOf(signer1)).to.equal(50n);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer1)).to.be.revertedWithCustomError(sua, "UnwrapNotFound");
    });

    it("a transfer does not cancel the proposal; an emptied address cannot be executed until the owner cancels", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await sua.connect(signer1).transfer(signer3, 60n);
      expect(await sua.unwrapProposals(signer1)).to.be.greaterThan(0n);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer1))
        .to.be.revertedWithCustomError(sua, "NothingToUnwrap").withArgs(signer1.address);
      await sua.connect(owner)["cancelUnwrap(address)"](signer1);
      expect(await sua.unwrapProposals(signer1)).to.equal(0n);
      // the new holder is a fresh proposal
      await sua.connect(owner)["proposeUnwrap(address)"](signer3);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await sua.executeUnwrap(signer3);
      expect(await base.balanceOf(signer3)).to.equal(60n);
    });

    it("executes the balance at execution time, not at proposal time", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await sua.connect(signer2).transfer(signer1, 15n);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer1)).to.emit(sua, "Unwrapped").withArgs(signer1.address, 75n, 75n);
      expect(await base.balanceOf(signer1)).to.equal(75n);
    });

    it("cannot execute against a frozen holder; works after unfreeze", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await sua.connect(owner).freeze(signer1);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer1))
        .to.be.revertedWithCustomError(sua, "Allowlist_SenderIsForbidden").withArgs(signer1.address);
      expect(await sua.unwrapProposals(signer1)).to.be.greaterThan(0n); // reverted, proposal intact
      await sua.connect(owner).unfreeze(signer1);
      await sua.executeUnwrap(signer1);
      expect(await base.balanceOf(signer1)).to.equal(60n);
    });

    it("a recovery that executes first leaves nothing to unwrap", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](signer1);
      await sua.connect(owner)["initRecovery(address,address)"](signer1, signer3);
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await sua.recover(signer1);
      expect(await sua.balanceOf(signer3)).to.equal(60n);
      await expect(sua.executeUnwrap(signer1))
        .to.be.revertedWithCustomError(sua, "NothingToUnwrap").withArgs(signer1.address);
    });
  });

  describe("contract holders", function () {
    let vault: Contract;

    beforeEach(async () => {
      // An Ownable contract owned by signer4 holds wrapped tokens; wrapped before termination.
      vault = await deployShares(signer4);
      await base.connect(owner).mintAndWrap(vault, sua, 30n);
      expect(await sua.balanceOf(vault)).to.equal(30n);
      await terminate(sua);
    });

    it("objects through its owner", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](vault);
      await expect(sua.connect(signer3).cancelUnwrapOnOwnedContract(vault))
        .to.be.revertedWithCustomError(sua, "Ownable_NotOwner").withArgs(signer3.address);
      await expect(sua.connect(signer4).cancelUnwrapOnOwnedContract(vault))
        .to.emit(sua, "UnwrapProposalCancelled").withArgs(signer4.address, await vault.getAddress());
      expect(await sua.unwrapProposals(vault)).to.equal(0n);
    });

    it("is unwrapped to its own address when nobody objects", async () => {
      await sua.connect(owner)["proposeUnwrap(address)"](vault);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await sua.executeUnwrap(vault);
      expect(await base.balanceOf(vault)).to.equal(30n);
      expect(await sua.balanceOf(vault)).to.equal(0n);
    });
  });

  describe("after a default migration", function () {
    let successor: Contract;

    beforeEach(async () => {
      successor = await deploySUA(base);
      await sua.connect(owner).proposeMigration(successor);
      await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);
      await sua.executeMigration();
      expect(await sua.binding()).to.equal(false);
      expect(await sua.base()).to.equal(await successor.getAddress());
      expect(await successor.balanceOf(sua)).to.equal(100n);
    });

    it("assisted unwrap delivers successor tokens to the straggler", async () => {
      await sua.connect(signer1).unwrap(60n); // signer1 acts, signer2 does not
      expect(await successor.balanceOf(signer1)).to.equal(60n);

      await sua.connect(owner)["proposeUnwrap(address)"](signer2);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer2)).to.emit(sua, "Unwrapped").withArgs(signer2.address, 40n, 40n);
      expect(await successor.balanceOf(signer2)).to.equal(40n);
      expect(await successor.balanceOf(sua)).to.equal(0n);
      expect(await sua.totalSupply()).to.equal(0n);
    });
  });

  describe("after an executed drag-along", function () {
    let currency: Contract;
    const buyer = signer3;
    const PRICE_PER_SHARE_E18 = ethers.parseUnits("2", 18);
    const TOTAL_PRICE = 200n;

    beforeEach(async () => {
      currency = await ethers.getContractAt("contracts/ERC20/IERC20.sol:IERC20", ZCHF_ADDRESS);
      await setZCHFBalance(await buyer.getAddress(), TOTAL_PRICE);
      await currency.connect(buyer).approve(sua, TOTAL_PRICE);
      await setBalance(await buyer.getAddress(), ethers.parseEther("3"));
      await sua.connect(buyer).offerAcquisition(currency, PRICE_PER_SHARE_E18, "tender", { value: DRAG_FEE });
      await connection.networkHelpers.time.increase(DRAG_DELAY + 1n);
      await sua.acceptOffer();
      expect(await sua.binding()).to.equal(false);
    });

    it("assisted unwrap pays out the proceeds to the straggler", async () => {
      const before = await currency.balanceOf(signer2);
      await sua.connect(owner)["proposeUnwrap(address)"](signer2);
      await connection.networkHelpers.time.increase(UNWRAP_DELAY + 1n);
      await expect(sua.executeUnwrap(signer2)).to.emit(sua, "Unwrapped").withArgs(signer2.address, 40n, 80n);
      expect(await currency.balanceOf(signer2) - before).to.equal(80n);
      expect(await sua.balanceOf(signer2)).to.equal(0n);
    });
  });
});
