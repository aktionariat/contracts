import { expect } from "chai";
import { Contract } from "ethers";
import { connection, ethers, owner, signer1, signer2, signer3 } from "./TestBase.ts";
import { setBalance, setZCHFBalance } from "../scripts/helpers/setBalance.ts";
import { ZCHF_ADDRESS } from "./Fixtures.ts";

// Tests for contracts/shares/sha/SharesUnderAgreement.sol (+ DragAlong + Modification).
//
// SharesUnderAgreement wraps a base Shares token 1:1 and binds it to a shareholder agreement.
// Self-contained: deploys its own base Shares and (for drag-along) a separate currency token,
// so no mainnet fork is required.

const BASE = { symbol: "TEST", name: "Test Company Shares", terms: "https://test.com/terms" };
const AGREEMENT_TERMS = "https://test.com/agreement";
const DECIMALS = 0;

const MIGRATION_DELAY = 20n * 24n * 60n * 60n; // 20 days
const DRAG_DELAY = 20n * 24n * 60n * 60n;      // 20 days
const DRAG_FEE = ethers.parseEther("1");       // deter(100) * 0.01 ether

async function deployShares(symbol: string, name: string): Promise<Contract> {
  const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
  const s = await Shares.deploy(symbol, name, BASE.terms, owner);
  await s.waitForDeployment();
  return s as unknown as Contract;
}

async function deploySharesUnderAgreement(base: Contract): Promise<Contract> {
  const SUA = await ethers.getContractFactory("contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement");
  const sua = await SUA.deploy(base, AGREEMENT_TERMS, DECIMALS, owner);
  await sua.waitForDeployment();
  return sua as unknown as Contract;
}

// Mint base shares to `holder`, approve the wrapper, and wrap them.
async function fundAndWrap(base: Contract, sua: Contract, holder: any, amount: bigint) {
  await base.connect(owner).mint(holder, amount);
  await base.connect(holder).approve(sua, amount);
  await sua.connect(holder)["wrap(uint256)"](amount);
}

describe("SharesUnderAgreement (sha/SharesUnderAgreement.sol)", function () {
  let base: Contract;
  let sharesUnderAgreement: Contract;

  beforeEach(async () => {
    base = await deployShares(BASE.symbol, BASE.name);
    sharesUnderAgreement = await deploySharesUnderAgreement(base);
  });

  describe("Deployment & params", function () {
    it("derives symbol/name from the base token and starts binding", async () => {
      expect(await sharesUnderAgreement.symbol()).to.equal(BASE.symbol + "S");
      expect(await sharesUnderAgreement.name()).to.equal(BASE.name + " SHA");
      expect(await sharesUnderAgreement.base()).to.equal(await base.getAddress());
      expect(await sharesUnderAgreement.terms()).to.equal(AGREEMENT_TERMS);
      expect(await sharesUnderAgreement.binding()).to.equal(true);
      expect(await sharesUnderAgreement.owner()).to.equal(await owner.getAddress());
      expect(await sharesUnderAgreement.decimals()).to.equal(0n);
    });
  });

  describe("Wrapping", function () {
    it("wraps base shares 1:1 and escrows the base", async () => {
      await fundAndWrap(base, sharesUnderAgreement, signer1, 40n);
      expect(await sharesUnderAgreement.balanceOf(signer1)).to.equal(40n);
      expect(await base.balanceOf(signer1)).to.equal(0n);
      expect(await base.balanceOf(sharesUnderAgreement)).to.equal(40n);
      expect(await sharesUnderAgreement.totalSupply()).to.equal(40n);
    });

    it("wraps for a different recipient", async () => {
      await base.connect(owner).mint(signer1, 30n);
      await base.connect(signer1).approve(sharesUnderAgreement, 30n);
      await sharesUnderAgreement.connect(signer1)["wrap(address,uint256)"](signer2, 30n);
      expect(await sharesUnderAgreement.balanceOf(signer2)).to.equal(30n);
      expect(await sharesUnderAgreement.balanceOf(signer1)).to.equal(0n);
    });

    it("wraps newly minted base via base.mintAndWrap (mintFromBase)", async () => {
      await base.connect(owner).mintAndWrap(signer3, sharesUnderAgreement, 25n);
      expect(await sharesUnderAgreement.balanceOf(signer3)).to.equal(25n);
      expect(await base.balanceOf(signer3)).to.equal(0n);
      expect(await base.balanceOf(sharesUnderAgreement)).to.equal(25n);
    });
  });

  describe("Unwrap & binding", function () {
    beforeEach(async () => {
      await fundAndWrap(base, sharesUnderAgreement, signer1, 50n);
    });

    it("refuses to unwrap while the agreement is binding", async () => {
      await expect(sharesUnderAgreement.connect(signer1).unwrap(10n)).to.revert(ethers);
    });

    it("allows unwrap 1:1 once the agreement is terminated", async () => {
      // Owner proposes termination, executes it after the delay -> binding becomes false.
      await sharesUnderAgreement.connect(owner).proposeTermination();
      await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);
      await sharesUnderAgreement.connect(owner).executeMigration();
      expect(await sharesUnderAgreement.binding()).to.equal(false);

      await sharesUnderAgreement.connect(signer1).unwrap(50n);
      expect(await sharesUnderAgreement.balanceOf(signer1)).to.equal(0n);
      expect(await base.balanceOf(signer1)).to.equal(50n);
    });
  });

  describe("Modification (termination governance)", function () {
    beforeEach(async () => {
      await fundAndWrap(base, sharesUnderAgreement, signer1, 100n);
    });

    it("rejects proposals from non-qualified holders (<10%)", async () => {
      // signer2 holds nothing -> not qualified
      await expect(sharesUnderAgreement.connect(signer2).proposeTermination()).to.revert(ethers);
    });

    it("refuses to execute before the delay", async () => {
      await sharesUnderAgreement.connect(owner).proposeTermination();
      await expect(sharesUnderAgreement.connect(owner).executeMigration()).to.revert(ethers);
    });

    it("can be vetoed via cancelMigration by the owner", async () => {
      await sharesUnderAgreement.connect(owner).proposeTermination();
      await sharesUnderAgreement.connect(owner).cancelMigration();
      await connection.networkHelpers.time.increase(MIGRATION_DELAY + 1n);
      await expect(sharesUnderAgreement.connect(owner).executeMigration()).to.revert(ethers);
      expect(await sharesUnderAgreement.binding()).to.equal(true);
    });
  });

  describe("DragAlong (acquisition)", function () {
    let currency: Contract;
    const buyer = signer3;
    const PRICE_PER_SHARE_E18 = ethers.parseUnits("2", 18); // 2 currency units per wrapped unit
    // 60 + 40 = 100 wrapped total -> totalPrice = 2 * 100 = 200 currency
    const TOTAL_PRICE = 200n;

    beforeEach(async () => {
      // Use the real forked ZCHF as the payment currency (a plain ERC20), not a securities token.
      currency = await ethers.getContractAt("contracts/ERC20/IERC20.sol:IERC20", ZCHF_ADDRESS);
      // Two holders so totalSupply = 100 and minority/majority logic is exercised.
      await base.connect(owner).mintAndWrap(signer1, sharesUnderAgreement, 60n);
      await base.connect(owner).mintAndWrap(signer2, sharesUnderAgreement, 40n);
      // Fund the buyer with currency + ETH for the deterrence fee, and approve the wrapper.
      await setZCHFBalance(await buyer.getAddress(), TOTAL_PRICE);
      await currency.connect(buyer).approve(sharesUnderAgreement, TOTAL_PRICE);
      await setBalance(await buyer.getAddress(), ethers.parseEther("3"));
    });

    async function makeOffer() {
      await sharesUnderAgreement.connect(buyer).offerAcquisition(currency, PRICE_PER_SHARE_E18, "tender", { value: DRAG_FEE });
    }

    it("records an offer and cannot be accepted before the delay", async () => {
      await makeOffer();
      const offer = await sharesUnderAgreement.latestOffer();
      expect(offer.buyer).to.equal(await buyer.getAddress());
      expect(offer.currency).to.equal(await currency.getAddress());
      await expect(sharesUnderAgreement.acceptOffer()).to.revert(ethers); // too early
    });

    it("lets the owner cancel an offer", async () => {
      await makeOffer();
      expect(await sharesUnderAgreement.canCancelOffer(owner)).to.equal(true);
      await sharesUnderAgreement.connect(owner).cancelOffer("withdrawn");
      const offer = await sharesUnderAgreement.latestOffer();
      expect(offer.buyer).to.equal(ethers.ZeroAddress);
    });

    it("executes the acquisition: pays holders, takes the base, terminates", async () => {
      await makeOffer();
      await connection.networkHelpers.time.increase(DRAG_DELAY + 1n);

      await sharesUnderAgreement.acceptOffer();

      // Buyer received the escrowed base (100) and paid TOTAL_PRICE currency.
      expect(await base.balanceOf(buyer)).to.equal(100n);
      expect(await currency.balanceOf(buyer)).to.equal(0n);
      // The wrapper's new base is the currency, and it now holds the proceeds.
      expect(await sharesUnderAgreement.base()).to.equal(await currency.getAddress());
      expect(await currency.balanceOf(sharesUnderAgreement)).to.equal(TOTAL_PRICE);
      expect(await sharesUnderAgreement.binding()).to.equal(false);

      // Holders unwrap to collect proceeds proportionally (60% / 40% of 200).
      // Assert on deltas: forked ZCHF balances can carry over from other suites.
      const signer1Before = await currency.balanceOf(signer1);
      await sharesUnderAgreement.connect(signer1).unwrap(60n);
      expect(await currency.balanceOf(signer1) - signer1Before).to.equal(120n);

      const signer2Before = await currency.balanceOf(signer2);
      await sharesUnderAgreement.connect(signer2).unwrap(40n);
      expect(await currency.balanceOf(signer2) - signer2Before).to.equal(80n);
    });
  });
});
