# Semantic Guard Analysis — Audit Report

- **Target:** Aktionariat contracts — branch `ai-audit` @ `0064dfb`
- **Date:** 2026-08-11
- **Method:** State Interaction Matrix over every external entrypoint in the audited surface, comparing the documented guard (NatSpec + sibling contracts) against the enforced guard on each path
- **PoCs:** `tests/AuditSemanticGuardAnalysis.ts` (5 tests, all passing)

## Findings

| # | Severity | Title | Status |
|---|----------|-------|--------|
| F1 | **Medium** | `BridgedSharesUnderAgreement` inherits permissionless recovery; CCIP pool / any holder balance is seizable, breaking the documented pool-only supply invariant | Confirmed (PoC) |
| F2 | **Medium** | `Modification._propose` has no pending-migration guard; a 10%+ holder can silently overwrite a pending migration/termination and reset the veto timer | Confirmed (PoC) |
| F3 | **Low** | `SecondaryMarket.process` executes trades without the `CURRENCY`/`TOKEN` pair check that `validateOrder` enforces | Confirmed (PoC) |
| F4 | **Low** | Upgradeable implementations are deployed without `_disableInitializers()`; anyone can re-initialize the implementation and take over its owner | Confirmed (PoC) |

Cross-references to the parallel findings streams: known finding #3 (`Recoverable.initRecovery`/`recover` on home-chain shares) is the root of F1; F1 is the adjacent, deeper variant in the *bridged* token, where the contract's own documentation asserts the invariant that the recovery path breaks.

---

## F1 (Medium) — Bridged token: inherited permissionless recovery seizes the CCIP pool / holder balances

**Files:** `contracts/multichain/BridgedSharesUnderAgreement.sol`, `contracts/shares/base/Recoverable.sol`

**Guard intended.** The bridged token's documentation is explicit:

> "Its supply is controlled exclusively by the CCIP pool and therefore always equals the amount of canonical tokens locked in the home-chain pool. … There is no other minting authority: not even the owner can mint, which is what keeps the remote supply pegged."

`mint()`/`burn()` are correctly gated by `onlyPool`, and `setPool()` by `onlyOwner`. On its own surface the supply invariant holds.

**Guard actually present.** `BridgedSharesUnderAgreement` inherits `Recoverable`, whose two relevant entrypoints are **unguarded**:

- `initRecovery(address lostAddress)` — `external payable`, no authorization: *anyone* registers any address as "lost", naming themselves (or anyone) as `recipient`, for a 0.01 ETH deterrence fee (`Recoverable.sol:73`).
- `recover(address lostAddress)` — `external`, no authorization: after the 184-day delay, anyone executes a transfer of the **entire** balance of `lostAddress` to the registered `recipient` (`Recoverable.sol:126`).

The victim can cancel only if they notice (`cancelRecovery()`, `cancelRecovery(address)` owner-only); the owner can cancel any recovery but must notice it within 184 days.

**Impact.** The documented "pool controls the supply" invariant is not enforceable on-chain. In the bridged context:

1. **Pool custody seizure (peg break).** The pool contract holds bridged tokens during lock-and-burn; if the pool ever carries a persistent balance (paused bridging, failed release, direct transfers), a stranger registers the pool as "lost" and 184 days later drains it. Bridged supply is then permanently unbacked — tokens burned on the destination can no longer be unlocked on the home chain.
2. **Holder seizure.** Any bridged-token holder can have their entire balance transferred to an attacker. Bridged tokens are minted on a remote chain where the issuer's operational attention is likely lower than on the home chain.

**PoC:** a stranger registers the `pool` address, advances 184 days, calls `recover(pool)`, and walks away with all 1000 tokens while `mint()` simultaneously rejects non-pool callers.

**Note.** Root is shared with known finding #3 (home-chain `Shares`/`SharesUnderAgreement`). Reported here because the bridged contract ships an explicit, stronger guarantee ("no other minting authority… keeps the remote supply pegged") that the recovery path silently voids, and the target includes the CCIP pool's custody rather than only individual holders.

**Fix.** Override the recovery surface in `BridgedSharesUnderAgreement`: revert `initRecovery`/`recover` when `lostAddress == pool` (protect the pool's custody), and/or gate recovery behind the owner. At minimum, document the exception so the "no other minting authority" invariant is not asserted.

---

## F2 (Medium) — `Modification._propose` has no pending-migration guard

**Files:** `contracts/shares/sha/Modification.sol`, `contracts/shares/sha/DragAlong.sol`

**Guard intended.** `proposeMigration` / `proposeTermination` are described as "propose" of a migration/termination that then goes through a veto window (`MIGRATION_PROPOSAL_DELAY`) before `executeMigration` (public) can run. The sibling governance slot, `DragAlong.offerAcquisition`, guards a pending proposal:

```solidity
function offerAcquisition(...) external payable deter(100) returns (Offer memory) {
    if (address(latestOffer.buyer) != address(0)) revert OfferPending();   // DragAlong.sol:85
```

**Guard actually present.** `Modification._propose` only checks `isQualified(msg.sender)` (owner or `>10%` of wrapped supply); it unconditionally overwrites `migration`:

```solidity
function _propose(IERC20 successor, uint8 migrationType) internal returns (Migration memory) {
    if (!isQualified(msg.sender)) revert NotQualified();
    migration = Migration({ successor: successor, timestamp: uint64(block.timestamp), migrationType: migrationType });
    emit MigrationProposed(msg.sender, successor, migrationType);
    return migration;
}
```

There is no equivalent of `OfferPending`: no revert if a migration is already pending, and no explicit cancel step (compare `cancelMigration`, which exists and emits `MigrationCancelled`).

**Impact.**
1. **Silent replacement.** A qualified holder overwrites the pending successor, type, and resets the veto timer in one step, without the visible `MigrationCancelled` event the intended cancel-then-propose flow produces. An issuer's pending *termination* can be flipped into a *migration to a hostile successor* with no cancel transaction on record.
2. **Governance DoS.** Each overwrite resets `timestamp` to `block.timestamp`, so a 10%+ holder can indefinitely restart the veto window of any migration/termination the issuer starts, blocking it silently.

Privilege note: a 10%+ holder already holds propose/cancel/execute power, so this is not a privilege escalation; it is a process-integrity gap (invisible state change + indefinite timer reset) that the sibling contract explicitly guards against.

**PoC:** issuer proposes termination; a holder with 20/20 wrapped tokens calls `proposeMigration(evil)`; the pending migration now points at the attacker's token, is `TYPE_DEFAULT`, and the veto timer restarts — no revert, no cancellation event.

**Fix:** revert in `_propose` when `migration.timestamp != 0` (mirroring `OfferPending`), forcing an explicit `cancelMigration()` first.

---

## F3 (Low) — `SecondaryMarket.process` executes off-pair trades

**Files:** `contracts/market/SecondaryMarket.sol`, `contracts/market/TradeReactor.sol`

**Guard intended.** The market's order validator restricts orders to the configured pair:

```solidity
function validateOrder(...) external view returns (...) {
    verifySignature(intent, sig);
    require((intent.tokenOut == TOKEN && intent.tokenIn == CURRENCY)
         || (intent.tokenOut == CURRENCY && intent.tokenIn == TOKEN), WrongTokens());   // SecondaryMarket.sol:161
```

**Guard actually present.** `process` never calls `validateOrder`; it checks only `isOpen` and the router:

```solidity
function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedAmount) external {
    if (!isOpen) revert MarketClosed();
    if (router != address(0) && msg.sender != router) revert WrongRouter(msg.sender, router);
    uint256 totalExecutionPrice = IReactor(REACTOR).getTotalExecutionPrice(buyer, seller, tradedAmount);
    uint256 totalFee = totalExecutionPrice * tradingFeeBips / 10000;
    IReactor(REACTOR).process(seller, sellerSig, buyer, buyerSig, tradedAmount, totalFee);
}
```

The reactor enforces only that the two intents reference the same pair (`TokenMismatch`, `TradeReactor.sol:121`), not that the pair is the market's. With `router == 0` (the default when deployed without one), anyone may call `process` with an arbitrary token pair.

**Impact.** The same sell intent that `validateOrder` rejects with `WrongTokens` is executed by `process`, settling in arbitrary tokens and collecting the market's trading fee (in arbitrary `tokenIn`) plus its license split. Fee accounting and the market's `CURRENCY`-denominated ledger become inconsistent; the pair restriction is effectively advisory. No direct theft from the market (fees accrue to the market and are owner-withdrawn), hence Low.

**PoC:** market configured for `shares`/`SHA`; a sell intent trading an unrelated token `X` for `shares` is rejected by `validateOrder` (`WrongTokens`) but successfully settled through `process` (fee collected in `shares`).

**Fix:** in `process`, verify both intents' pairs with the same check as `validateOrder` (or call `validateOrder`), reverting `WrongTokens` for off-pair intents.

---

## F4 (Low) — Implementations can be re-initialized by anyone

**Files:** `contracts/multichain/BridgedSharesUnderAgreement.sol`, `contracts/ERC20/ERC20Named.sol`, `contracts/factories/FactoryDestination.sol` (and the `Shares`/`SHA` equivalents in `FactorySource.sol`)

**Guard intended.** The factory deploys EIP-1167 clones and initializes them:

```solidity
deployment.bridgedSharesUnderAgreement = Clones.cloneDeterministic(BSHA_IMPLEMENTATION, salt);
BridgedSharesUnderAgreement(deployment.bridgedSharesUnderAgreement).initialize(...);   // FactoryDestination.sol:126,129
```

`initialize()` carries the OZ `initializer` modifier, so each clone can be initialized exactly once.

**Guard actually present.** The implementation itself is constructed by a constructor that calls the `__*_init` helpers (all `onlyInitializing`) but **never calls `_disableInitializers()`**. The implementation's `_initialized` storage slot therefore stays `0`, so `initializer` passes on the implementation: anyone can call `initialize(...)` on the implementation and run `__Ownable_init(_admin)` with an arbitrary `_admin`.

**Impact.** A stranger becomes owner of the implementation's storage and can change its symbol/name/terms/owner. With the current clone-based deployment this does not affect proxies (each clone has its own storage), so impact is Limited today — but it deviates from the OZ upgradeable pattern, and the moment an implementation is ever used directly, or proxied without a fresh `initialize`, the take-over is complete (owner, terms, and — for the shares implementations — minting rights).

**PoC:** a directly-deployed `BridgedSharesUnderAgreement` is re-initialized by a stranger with an attacker-chosen symbol/name/owner; `owner()` now returns the attacker.

**Fix:** call `_disableInitializers()` in the constructors of every implementation (`BridgedSharesUnderAgreement`, `Shares`, `SharesUnderAgreement`, …) or drop the `initializer` modifier from `initialize` and let it be gated by the factory.

---

## Excluded hypotheses (verified, not findings)

1. **`SecondaryMarket.placeOrder` always reverts.** Hypothesis: the market's `verifySignature` requires `filler == market`, while the reactor's `verify` requires `filler == msg.sender`, which the order owner cannot satisfy. **Rejected by test:** when the market forwards the intent it is the `msg.sender`, so `filler == market == msg.sender`; `placeOrder` works. (This hypothesis came from corrupted source reads; the runtime proof settled it.)
2. **`PaymentHub.checkPath` uses a backwards V3 path.** `checkPath` asserts `path[0:20] == base` and `path[last] == paymentCurrency`. For `SwapRouter.exactOutput` the path is output-first, so this ordering is **correct**; `exactOutput` delivers `base` to the DirectInvestment while the caller pays `paymentCurrency`.
3. **`PaymentHub.multiPay` token drain.** `multiPay` pulls `safeTransferFrom(msg.sender, …)`; the hub holds no balance and no third-party funds are at risk.
4. **DirectInvestment price/withdraw.** `notifyTradeAndTransfer`, `withdraw`, and `migrate` are all `onlyOwner`; `processIncoming` enforces the exact execution price. No unguarded path found.

## Leads (not PoC'd)

- **Partial-fill rounding in `TradeReactor.getAsk`** (`TradeReactor.sol:76`). `getAsk` rounds *up*; splitting a fill over several transactions can charge the buyer more than the seller's stated ask (bounded per fill). The reactor enforces the buyer's overfill limit on the token side (`amountIn`) but never caps the total currency the buyer pays against `amountOut`. Low, bounded impact; worth a dedicated analysis before the next version.
- **`Recoverable.cancelRecovery()` semantics.** Only the *lost* address (or the owner) can cancel; a recovery registered against a victim who has lost key access cannot be cancelled by anyone else.

## Test evidence

```
tests/AuditSemanticGuardAnalysis.ts
  F1: anyone can seize the CCIP pool's bridged-token balance after 184 days       ✔
  F2: a 10%+ holder replaces the issuer's pending termination with a migration    ✔
  F3: process() bypasses the CURRENCY/TOKEN pair check that validateOrder() has   ✔
  F4: a stranger takes ownership of a directly-deployed BridgedSharesUnderAgreement via initialize()  ✔
  EXCLUSION: placeOrder filler guard chain is sound                                ✔
9 passing
```
