import { expect } from "chai";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer2,
  signer3,
} from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";

import { expectUserToBeFree } from "./lib/allowlist.ts";

import { Shares } from "../types/ethers-contracts/index.ts";

// TODO added for burns tests
// // negative no balance and no flag: underflow uint256
// expect(shares.connect(owner).mint(signer1, -5n))
//   .to.be.revertedWithCustomError(shares, "ERC20InsufficientBalance")
//   .withArgs(await owner.getAddress(), 0n, -5n);

// // negative no balance and flag: ERC20InsufficientBalance
// await shares["setType(address,uint8)"](await owner.getAddress(), 1n);
// expect(shares.connect(owner).mint(signer1, -5n))
//   .to.be.revertedWithCustomError(shares, "ERC20InsufficientBalance")
//   .withArgs(await owner.getAddress(), 0n, -5n);

// Baseline test suite for the new self-contained share token in contracts/shares/base/Shares.sol.
// Deploys the contract directly (no ignition / no mainnet fork) since it has no external dependencies.

const SHARE = {
  symbol: "TEST",
  name: "Test Company Shares",
  terms: "https://test.com/terms",
};

const DETERRENCE_FEE = ethers.parseEther("0.01");
const RECOVERY_DELAY = 184n * 24n * 60n * 60n; // 184 days in seconds

/**
 * Deploys and returns a Shares contract instance.
 * Fields are written using the `SHARES` top level constant.
 * Uses `owner` as deployer.
 *
 * @returns Shares contract promise
 */
async function deployShares(): Promise<Shares> {
  const Shares = await ethers.getContractFactory("Shares");
  const shares = await Shares.deploy(
    SHARE.symbol,
    SHARE.name,
    SHARE.terms,
    owner
  );
  await shares.waitForDeployment();
  return shares;
}

describe("Shares (shares/base/Shares.sol)", function () {
  describe("Deployment & params", function () {
    let shares: Shares;

    before(async () => {
      shares = await deployShares();
    });

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
      expect(await shares.successor()).to.equal(ethers.ZeroAddress);

      // expect init to not be callable
      const attacker = signer1;
      expect(
        shares.initialize(SHARE.symbol, SHARE.name, SHARE.terms, attacker)
      ).to.be.revertedWithCustomError(shares, "InvalidInitialization");
    });

    it("can set terms", async () => {
      const newTerms = "https://new.com/terms";
      await expect(shares.connect(owner).setTerms(newTerms))
        .to.emit(shares, "ChangeTerms")
        .withArgs(newTerms);
      expect(await shares.terms()).to.equal(newTerms);

      // only owner can set terms
      await expect(
        shares.connect(signer1).setTerms("https://attacker.com")
      ).to.revert(ethers);
    });

    it("can set successor", async () => {
      // deploy mock successor
      const MockSuccessor = await ethers.getContractFactory(
        "MockSuccessorToken"
      );
      const mock = await MockSuccessor.deploy();
      await mock.waitForDeployment();

      // only owner can set successor
      await expect(shares.connect(signer1).setSuccessor(mock)).to.revert(
        ethers
      );

      // owner sets the mock as successor
      // we check even from call notifyBurned(address(0), 0)
      await expect(shares.connect(owner).setSuccessor(mock))
        .to.emit(mock, "NotifyBurned")
        .withArgs(ethers.ZeroAddress, 0n)
        .to.emit(shares, "SuccessorDefined")
        .withArgs(await mock.getAddress());
      expect(await shares.successor()).to.equal(await mock.getAddress());

      // setting an EOA as successor skips the code check
      await shares.connect(owner).setSuccessor(signer3);
      expect(await shares.successor()).to.equal(await signer3.getAddress());
    });

    it("can emit announcements", async () => {
      const msg = "Hello shareholders";
      await expect(shares.connect(owner).announcement(msg))
        .to.emit(shares, "Announcement")
        .withArgs(msg);

      // only owner can emit
      await expect(shares.connect(signer1).announcement("pwned")).to.revert(
        ethers
      );
    });
  });

  describe("Minting", function () {
    // Covered functions are:
    // mint
    // batchMint
    // mintAndWrap
    // batchMintAndWrap

    let shares: Shares;

    beforeEach(async () => {
      shares = await deployShares();
    });

    it("mints only by owner", async () => {
      // only owner can mint
      await expect(shares.connect(signer1).mint(signer1, 100n))
        .to.be.revertedWithCustomError(shares, "Ownable_NotOwner")
        .withArgs(signer1);

      // make sure everyone is free
      await expectUserToBeFree(shares, await owner.getAddress());
      await expectUserToBeFree(shares, await signer1.getAddress());

      // mint shares to address
      await shares.connect(owner).mint(signer1, 100n);
      expect(await shares.balanceOf(signer1)).to.equal(100n);
      expect(await shares.totalSupply()).to.equal(100n);

      // make sure everyone is free after mint
      await expectUserToBeFree(shares, await owner.getAddress());
      await expectUserToBeFree(shares, await signer1.getAddress());
    });

    it("can't mint quantity that modifies internal flags", async () => {
      // TODO move to Allowlist.ts
      // we try to min uint256: we assume flags have at least one bit of space
      await expect(shares.connect(owner).mint(signer1, ethers.MaxUint256))
        .to.revertedWithCustomError(shares, "ERC20InsufficientBalance")
        .withArgs(await signer1.getAddress(), 0n, ethers.MaxUint256);
    });

    it("batchMints to many recipients", async () => {
      await shares.connect(owner).batchMint([signer1, signer2], [10n, 20n]);
      expect(await shares.balanceOf(signer1)).to.equal(10n);
      expect(await shares.balanceOf(signer2)).to.equal(20n);
    });

    it("reverts batchMint on length mismatch", async () => {
      await expect(
        shares.connect(owner).batchMint([signer1, signer2], [10n])
      ).to.revertedWithCustomError(shares, "ArrayLengthMismatch");
    });
  });

  describe("Transfers & allowlist", function () {
    let shares: Shares;

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
      await expect(shares.connect(signer1).transfer(signer2, 1n)).to.revert(
        ethers
      );
      // give signer2 some balance first via direct mint? mint to restricted also blocked -> unfreeze, mint, refreeze
      await shares.connect(owner).unfreeze(signer2);
      await shares.connect(owner).mint(signer2, 10n);
      await shares.connect(owner).freeze(signer2);
      // restricted can only send to an admin address (address(0) is not admin unless applicable)
      await expect(shares.connect(signer2).transfer(signer1, 1n)).to.revert(
        ethers
      );
    });

    it("freeze/unfreeze are owner-only", async () => {
      await expect(shares.connect(signer1).freeze(signer2)).to.revert(ethers);
      await expect(shares.connect(signer1).unfreeze(signer2)).to.revert(ethers);
    });
  });

  describe("Pause", function () {
    let shares: Shares;

    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("blocks transfers, mints and burns while paused", async () => {
      await shares.connect(owner).pause();
      await expect(shares.connect(signer1).transfer(signer2, 1n)).to.revert(
        ethers
      );
      await expect(shares.connect(owner).mint(signer1, 1n)).to.revert(ethers);
      await expect(shares.connect(signer1)["burn(uint256)"](1n)).to.revert(
        ethers
      );
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
    let shares: Shares;

    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("routes burned tokens through the owner and reduces supply", async () => {
      const balanceBefore = await shares.balanceOf(await signer1.getAddress());
      const supplyBefore = await shares.totalSupply();

      const toBurnAmount = 30n;
      expect(await shares.connect(signer1)["burn(uint256)"](toBurnAmount))
        .to.emit(shares, "Transfer")
        .withArgs(await owner.getAddress(), ethers.ZeroAddress, toBurnAmount);

      expect(await shares.balanceOf(signer1)).to.equal(
        balanceBefore - toBurnAmount
      );
      expect(await shares.totalSupply()).to.equal(supplyBefore - toBurnAmount);
    });

    it("reverts if burn modifies flag bits", async () => {
      // TODO move to Allowlist.ts
      const balanceBefore = await shares.balanceOf(await signer1.getAddress());

      // apply Admin flag
      const ADMIN_TYPE = 4n;
      await expect(
        shares
          .connect(owner)
          ["setType(address,uint8)"](await signer1.getAddress(), ADMIN_TYPE)
      )
        .to.emit(shares, "AddressTypeUpdate")
        .withArgs(await signer1.getAddress(), ADMIN_TYPE);

      const toBurnAmount = balanceBefore + 1n;
      await expect(shares.connect(signer1)["burn(uint256)"](toBurnAmount))
        .to.revertedWithCustomError(shares, "ERC20InsufficientBalance")
        .withArgs(await signer1.getAddress(), balanceBefore, toBurnAmount);
    });
  });

  describe("Recovery", function () {
    let shares: Shares;

    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
      await setBalance(await signer2.getAddress(), ethers.parseEther("1"));
    });

    it("recovers a lost balance to the proposed recipient after the delay", async () => {
      // signer2 proposes to recover signer1's balance to itself, paying the deterrence fee
      await shares
        .connect(signer2)
        ["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
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
      await shares
        .connect(signer2)
        ["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
      await shares.connect(signer1).cancelRecovery();
      const rec = await shares.recoveries(signer1);
      expect(rec.timestamp).to.equal(0n);
      // recovery no longer executable
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await expect(shares.connect(signer2).recover(signer1)).to.revert(ethers);
    });

    it("requires the deterrence fee from non-owner proposers", async () => {
      await expect(
        shares.connect(signer2)["initRecovery(address)"](signer1)
      ).to.revert(ethers);
    });

    it("rejects a second recovery while one is in progress", async () => {
      await shares
        .connect(signer2)
        ["initRecovery(address)"](signer1, { value: DETERRENCE_FEE });
      await expect(
        shares
          .connect(signer2)
          ["initRecovery(address)"](signer1, { value: DETERRENCE_FEE })
      ).to.revert(ethers);
    });

    // Owner-initiated time-locked burn. initBurn registers a recovery whose recipient is
    // address(0) (the "burn" sentinel); after the delay, burn(lostAddress) destroys the balance.
    it("lets the owner time-locked-burn a balance after the delay", async () => {
      await shares.connect(owner).initBurn(signer1);
      // too early
      await expect(shares.connect(owner)["burn(address)"](signer1)).to.revert(
        ethers
      );

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
      await expect(shares.connect(owner)["burn(address)"](signer1)).to.revert(
        ethers
      ); // RecoveryNotFound
    });
  });

  describe("Successor migration", function () {
    let shares: Shares;

    beforeEach(async () => {
      shares = await deployShares();
      await shares.connect(owner).mint(signer1, 100n);
    });

    it("reverts migrate when no successor is set", async () => {
      await expect(shares.connect(signer1)["migrate()"]()).to.revert(ethers);
    });

    it("sets successor (owner-only)", async () => {
      // EOA successor: setSuccessor skips the notifyBurned sanity check when there is no code
      await expect(shares.connect(signer1).setSuccessor(signer3)).to.revert(
        ethers
      );
      await shares.connect(owner).setSuccessor(signer3);
      expect(await shares.successor()).to.equal(await signer3.getAddress());
    });

    it("migrate(amount) transfers tokens to successor, burns them, and emits notifyBurned", async () => {
      const MockSuccessor = await ethers.getContractFactory(
        "MockSuccessorToken"
      );
      const mock = await MockSuccessor.deploy();
      await mock.waitForDeployment();

      await shares.connect(owner).setSuccessor(mock);

      const supplyBefore = await shares.totalSupply();
      const userAddr = await signer1.getAddress();
      const mockAddr = await mock.getAddress();

      await expect(shares.connect(signer1)["migrate(uint256)"](40n))
        .to.emit(mock, "NotifyBurned")
        .withArgs(userAddr, 40n);

      // signer1 had 100, migrated 40 -> 60 left
      expect(await shares.balanceOf(signer1)).to.equal(60n);
      // successor received 40 then burned them -> balance is 0
      expect(await shares.balanceOf(mockAddr)).to.equal(0n);
      // total supply reduced by 40
      expect(await shares.totalSupply()).to.equal(supplyBefore - 40n);
      // mock recorded the calls: 1 from setSuccessor sanity check + 1 from migrate
      expect(await mock.lastBeneficiary()).to.equal(userAddr);
      expect(await mock.lastAmount()).to.equal(40n);
      expect(await mock.notifyCount()).to.equal(2n);
    });

    it("migrate() convenience migrates the full remaining balance", async () => {
      const MockSuccessor = await ethers.getContractFactory(
        "MockSuccessorToken"
      );
      const mock = await MockSuccessor.deploy();
      await mock.waitForDeployment();

      await shares.connect(owner).setSuccessor(mock);

      const supplyBefore = await shares.totalSupply();
      const userAddr = await signer1.getAddress();

      // signer1 has 100 -> migrate everything
      await expect(shares.connect(signer1)["migrate()"]())
        .to.emit(mock, "NotifyBurned")
        .withArgs(userAddr, 100n);

      expect(await shares.balanceOf(signer1)).to.equal(0n);
      expect(await shares.totalSupply()).to.equal(supplyBefore - 100n);
      expect(await mock.lastAmount()).to.equal(100n);
    });
  });
});
