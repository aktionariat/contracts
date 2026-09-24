import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer2, signer3 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";

// Baseline test suite for the new self-contained share token in contracts/shares/base/Shares.sol.
// Deploys the contract directly (no ignition / no mainnet fork) since it has no external dependencies.

const SHARE = {
  symbol: "TEST",
  name: "Test Company Shares",
  terms: "https://test.com/terms",
};

const DETERRENCE_FEE = ethers.parseEther("0.01");
const RECOVERY_DELAY = 184n * 24n * 60n * 60n; // 184 days in seconds

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
  const shares = await Shares.deploy(SHARE.symbol, SHARE.name, SHARE.terms, owner);
  await shares.waitForDeployment();
  return shares as unknown as Contract;
}

describe("Shares (base/Shares.sol)", function () {

  describe("Deployment & params", function () {
    let shares: Contract;
    before(async () => { shares = await deployShares(); });

    it("deploys", async () => {
      expect(await shares.getAddress()).to.exist;
    });

    it("exposes constructor params", async () => {
      expect(await shares.symbol()).to.equal(SHARE.symbol);
      expect(await shares.name()).to.equal(SHARE.name);
      expect(await shares.terms()).to.equal(SHARE.terms);
      expect(await shares.owner()).to.equal(await owner.getAddress());
      expect(await shares.decimals()).to.equal(0n);
      expect(await shares.VERSION()).to.equal(6n);
      expect(await shares.deterrenceFee()).to.equal(DETERRENCE_FEE);
      expect(await shares.tokenId()).to.equal("");
    });

    it("sets the token id (owner-only)", async () => {
      await expect(shares.connect(signer1).setTokenId("CH0000000000")).to.revert(ethers);
      await expect(shares.connect(owner).setTokenId("CH0000000000")).to.emit(shares, "ChangeTokenId").withArgs("CH0000000000");
      expect(await shares.tokenId()).to.equal("CH0000000000");
    });
  });

  describe("Minting", function () {
    let shares: Contract;
    beforeEach(async () => { shares = await deployShares(); });

    it("mints only by owner", async () => {
      await shares.connect(owner).mint(signer1, 100n);
      expect(await shares.balanceOf(signer1)).to.equal(100n);
      expect(await shares.totalSupply()).to.equal(100n);
      await expect(shares.connect(signer1).mint(signer1, 1n)).to.revert(ethers);
    });

    it("batchMints to many recipients", async () => {
      await shares.connect(owner).batchMint([signer1, signer2], [10n, 20n]);
      expect(await shares.balanceOf(signer1)).to.equal(10n);
      expect(await shares.balanceOf(signer2)).to.equal(20n);
    });

    it("reverts batchMint on length mismatch", async () => {
      await expect(shares.connect(owner).batchMint([signer1, signer2], [10n])).to.revert(ethers);
    });
  });

  describe("Transfers & allowlist", function () {
    let shares: Contract;
    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("transfers freely when allowlist is not applicable", async () => {
      await shares.connect(signer1).transfer(signer2, 40n);
      expect(await shares.balanceOf(signer2)).to.equal(40n);
    });

    it("auto-allowlists minted recipients once applicable", async () => {
      await shares.connect(owner).setApplicable(true);
      // address(0) becomes ADMIN; minting from it should mark the recipient ALLOWED
      await shares.connect(owner).mint(signer3, 50n);
      expect(await shares.isAllowed(signer3)).to.equal(true);
    });

    it("blocks transfers to/from a frozen (restricted) address", async () => {
      await shares.connect(owner).freeze(signer2);
      expect(await shares.isRestricted(signer2)).to.equal(true);
      // cannot receive
      await expect(shares.connect(signer1).transfer(signer2, 1n)).to.revert(ethers);
      // give signer2 some balance first via direct mint? mint to restricted also blocked -> unfreeze, mint, refreeze
      await shares.connect(owner).unfreeze(signer2);
      await shares.connect(owner).mint(signer2, 10n);
      await shares.connect(owner).freeze(signer2);
      // restricted can only send to the owner: not to a free address, not even to an admin address
      await expect(shares.connect(signer2).transfer(signer1, 1n)).to.revert(ethers);
      await shares.connect(owner)["setType(address,uint8)"](signer3, await shares.TYPE_ADMIN());
      await expect(shares.connect(signer2).transfer(signer3, 1n))
        .to.be.revertedWithCustomError(shares, "Allowlist_SenderIsForbidden").withArgs(signer2.address);
      // the owner cannot send to a restricted address either
      await expect(shares.connect(owner).transfer(signer2, 1n))
        .to.be.revertedWithCustomError(shares, "Allowlist_ReceiverIsForbidden").withArgs(signer2.address);
      // but the restricted holder can hand tokens back to the owner
      await shares.connect(signer2).transfer(owner, 4n);
      expect(await shares.balanceOf(signer2)).to.equal(6n);
      expect(await shares.balanceOf(owner)).to.equal(4n);
    });

    it("freeze/unfreeze are owner-only", async () => {
      await expect(shares.connect(signer1).freeze(signer2)).to.revert(ethers);
      await expect(shares.connect(signer1).unfreeze(signer2)).to.revert(ethers);
    });

    it("does not allowlist the recipient of a zero-value transferFrom from an admin", async () => {
      await shares.connect(owner)["setType(address,uint8)"](signer1, await shares.TYPE_ADMIN());
      // anyone can call transferFrom with amount 0: no allowance is consumed
      await shares.connect(signer2).transferFrom(signer1, signer3, 0n);
      expect(await shares.isAllowed(signer3)).to.equal(false);
      // a real admin transfer still allowlists
      await shares.connect(signer1).transfer(signer3, 1n);
      expect(await shares.isAllowed(signer3)).to.equal(true);
    });

    it("keeps minting to new holders after a burn routed through an admin owner", async () => {
      await shares.connect(owner)["setType(address,uint8)"](owner, await shares.TYPE_ADMIN());
      // burn moves the tokens to the owner and burns them there: hook sees from=owner(ADMIN), to=0
      await shares.connect(signer1)["burn(uint256)"](30n);
      expect(await shares.isAllowed(ethers.ZeroAddress)).to.equal(false);
      await shares.connect(owner).mint(signer3, 10n);
      expect(await shares.balanceOf(signer3)).to.equal(10n);
      expect(await shares.isAllowed(signer3)).to.equal(false);
    });
  });

  describe("Pause", function () {
    let shares: Contract;
    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("blocks transfers, mints and burns while paused", async () => {
      await shares.connect(owner).pause();
      await expect(shares.connect(signer1).transfer(signer2, 1n)).to.revert(ethers);
      await expect(shares.connect(owner).mint(signer1, 1n)).to.revert(ethers);
      await expect(shares.connect(signer1)["burn(uint256)"](1n)).to.revert(ethers);
    });

    it("resumes after unpause", async () => {
      await shares.connect(owner).pause();
      await shares.connect(owner).unpause();
      await shares.connect(signer1).transfer(signer2, 1n);
      expect(await shares.balanceOf(signer2)).to.equal(1n);
    });

    it("pause/unpause are owner-only", async () => {
      await expect(shares.connect(signer1).pause()).to.revert(ethers);
    });
  });

  describe("Holder self-burn", function () {
    let shares: Contract;
    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("routes burned tokens through the owner and reduces supply", async () => {
      const supplyBefore = await shares.totalSupply();
      await shares.connect(signer1)["burn(uint256)"](30n);
      expect(await shares.balanceOf(signer1)).to.equal(70n);
      expect(await shares.totalSupply()).to.equal(supplyBefore - 30n);
    });

    // The owner and the zero address are sinks: the allowlist types never block a burn.
    it("lets an allowlisted holder burn to a free owner", async () => {
      await shares.connect(owner)["setType(address,uint8)"](signer1, await shares.TYPE_ALLOWED());
      expect(await shares.isAllowed(owner)).to.equal(false);
      await expect(shares.connect(signer1).transfer(signer2, 1n)).to.revert(ethers); // allowed -> free blocked
      await shares.connect(signer1)["burn(uint256)"](30n);
      expect(await shares.balanceOf(signer1)).to.equal(70n);
      expect(await shares.isAllowed(owner)).to.equal(false); // sending to the owner does not retype it
    });

    it("keeps burning after an admin transfer stamped the owner ALLOWED", async () => {
      await shares.connect(owner)["setType(address,uint8)"](signer1, await shares.TYPE_ADMIN());
      await shares.connect(signer1).transfer(owner, 1n);
      expect(await shares.isAllowed(owner)).to.equal(true);
      await shares.connect(owner).mint(signer2, 10n);
      // signer2 is free, the owner ALLOWED and address zero free: both legs must still pass
      await shares.connect(signer2)["burn(uint256)"](10n);
      expect(await shares.balanceOf(signer2)).to.equal(0n);
      expect(await shares.balanceOf(owner)).to.equal(1n);
    });

    it("lets a frozen holder burn, the tokens go through the owner", async () => {
      await shares.connect(owner).freeze(signer1);
      const supplyBefore = await shares.totalSupply();
      await shares.connect(signer1)["burn(uint256)"](40n);
      expect(await shares.balanceOf(signer1)).to.equal(60n);
      expect(await shares.totalSupply()).to.equal(supplyBefore - 40n);
    });
  });

  describe("Recovery", function () {
    let shares: Contract;
    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
      await setBalance(await signer2.getAddress(), ethers.parseEther("1"));
    });

    it("recovers a lost balance to the proposed recipient after the delay", async () => {
      // signer2 proposes to recover signer1's balance to itself, paying the deterrence fee
      await shares.connect(signer2)["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
      const rec = await shares.recoveries(signer1);
      expect(rec.recipient).to.equal(await signer2.getAddress());

      // too early
      await expect(shares.connect(signer2).recover(signer1)).to.revert(ethers);

      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await shares.connect(signer2).recover(signer1);
      expect(await shares.balanceOf(signer1)).to.equal(0n);
      expect(await shares.balanceOf(signer2)).to.equal(100n);
    });

    it("lets the lost address veto the recovery via cancelRecovery", async () => {
      await shares.connect(signer2)["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
      await shares.connect(signer1).cancelRecovery();
      const rec = await shares.recoveries(signer1);
      expect(rec.timestamp).to.equal(0n);
      // recovery no longer executable
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await expect(shares.connect(signer2).recover(signer1)).to.revert(ethers);
    });

    it("requires the deterrence fee from non-owner proposers", async () => {
      await expect(shares.connect(signer2)["initRecovery(address)"](signer1)).to.revert(ethers);
    });

    it("rejects a second recovery while one is in progress", async () => {
      await shares.connect(signer2)["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
      await expect(
        shares.connect(signer2)["initRecovery(address)"](signer1, { value: DETERRENCE_FEE })
      ).to.revert(ethers);
    });

    // Owner-initiated time-locked burn. initBurn registers a recovery whose recipient is
    // address(0) (the "burn" sentinel); after the delay, burn(lostAddress) destroys the balance.
    it("lets the owner time-locked-burn a balance after the delay", async () => {
      await shares.connect(owner).initBurn(signer1);
      // too early
      await expect(shares.connect(owner)["burn(address)"](signer1)).to.revert(ethers);

      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      const supplyBefore = await shares.totalSupply();
      await shares.connect(owner)["burn(address)"](signer1);
      expect(await shares.balanceOf(signer1)).to.equal(0n);
      expect(await shares.totalSupply()).to.equal(supplyBefore - 100n);
    });

    it("does not let recover() execute a burn entry (recipient 0)", async () => {
      await shares.connect(owner).initBurn(signer1);
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await expect(shares.connect(signer1).recover(signer1)).to.revert(ethers); // NotRecovery
    });

    it("lets the lost address veto a burn via cancelRecovery", async () => {
      await shares.connect(owner).initBurn(signer1);
      await shares.connect(signer1).cancelRecovery();
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await expect(shares.connect(owner)["burn(address)"](signer1)).to.revert(ethers); // RecoveryNotFound
    });

    // A frozen address may only send to the owner. The issuer burn takes that route, so it works on
    // frozen and allowlisted addresses alike; a recovery to anyone but the owner does not.
    it("lets the owner burn a frozen balance", async () => {
      await shares.connect(owner).freeze(signer1);
      await shares.connect(owner).initBurn(signer1);
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      const supplyBefore = await shares.totalSupply();
      await expect(shares.connect(owner)["burn(address)"](signer1))
        .to.emit(shares, "Transfer").withArgs(signer1.address, owner.address, 100n)
        .and.to.emit(shares, "Transfer").withArgs(owner.address, ethers.ZeroAddress, 100n);
      expect(await shares.balanceOf(signer1)).to.equal(0n);
      expect(await shares.balanceOf(owner)).to.equal(0n);
      expect(await shares.totalSupply()).to.equal(supplyBefore - 100n);
    });

    it("recovers a frozen balance only to the owner", async () => {
      await shares.connect(owner).freeze(signer1);
      await shares.connect(signer2)["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await expect(shares.connect(signer2).recover(signer1))
        .to.be.revertedWithCustomError(shares, "Allowlist_SenderIsForbidden").withArgs(signer1.address);

      await shares.connect(owner)["cancelRecovery(address)"](signer1);
      await shares.connect(signer2)["initRecovery(address,address)"](signer1, owner, { value: DETERRENCE_FEE });
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await shares.connect(signer2).recover(signer1);
      expect(await shares.balanceOf(owner)).to.equal(100n);
    });

    it("burns an allowlisted balance while address zero is free", async () => {
      await shares.connect(owner)["setType(address,uint8)"](signer1, await shares.TYPE_ALLOWED());
      await shares.connect(owner).initBurn(signer1);
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await shares.connect(owner)["burn(address,uint256)"](signer1, 60n);
      expect(await shares.balanceOf(signer1)).to.equal(40n);
    });
  });

  describe("Successor migration", function () {
    let shares: Contract;
    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("reverts migrate when no successor is set", async () => {
      await expect(shares.connect(signer1)["migrate()"]()).to.revert(ethers);
    });

    it("sets successor (owner-only)", async () => {
      // EOA successor: setSuccessor skips the notifyBurned sanity check when there is no code
      await expect(shares.connect(signer1).setSuccessor(signer3)).to.revert(ethers);
      await shares.connect(owner).setSuccessor(signer3);
      expect(await shares.successor()).to.equal(await signer3.getAddress());
    });

    // Full migrate() flow needs a mock ISuccessorToken implementing notifyBurned -> TODO once a mock contract is agreed.
  });
});
