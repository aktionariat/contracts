# 🔐 Market & Share-Token Integrity Analysis — Aktionariat

Branch `ai-audit` @ `0064dfb` · 2026-08-11

Skill: follow-up integrity analysis on `SecondaryMarket`/`TradeReactor` order processing, `Modification` migration governance, and the multichain `BridgedSharesUnderAgreement` (previously out of scope).

---

## Scope

|                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In scope (this pass)**           | `market/SecondaryMarket.sol` · `market/TradeReactor.sol` · `shares/sha/Modification.sol` · `multichain/BridgedSharesUnderAgreement.sol` · `shares/base/Recoverable.sol` (interaction)                                                                                                                                                                                                                                                                                                                             |
| **Previous passes**                | pashov targeted review ([`contracts-ai-audit-report-pashov-2026-08-11.md`](contracts-ai-audit-report-pashov-2026-08-11.md)) · reentrancy pattern analysis ([`contracts-ai-audit-report-reentrancy-pattern-analysis-2026-08-11.md`](contracts-ai-audit-report-reentrancy-pattern-analysis-2026-08-11.md)) · DoS & griefing ([`tests/AuditDosGriefingAnalysis.ts`](../tests/AuditDosGriefingAnalysis.ts)) · oracle/flash-loan ([`tests/AuditOracleFlashloanAnalysis.ts`](../tests/AuditOracleFlashloanAnalysis.ts)) |
| **Pre-existing (not re-reported)** | ① `TradeReactor.process` filler-controlled `totalFee` · ② `Shares.burn` address(0) allowlist corruption · ③ permissionless `Recoverable.initRecovery/recover` + fee swallow                                                                                                                                                                                                                                                                                                                                       |
| **Proof-of-concept tests**         | [`tests/AuditMarketSharesIntegrity.ts`](../tests/AuditMarketSharesIntegrity.ts) — 6 tests, all passing                                                                                                                                                                                                                                                                                                                                                                                                            |

Run with `npx hardhat test tests/AuditMarketSharesIntegrity.ts`.

---

## Bottom line

Three confirmed findings, all reproduced end-to-end:

- **M-1 (MEDIUM)** — `SecondaryMarket.process` never verifies the traded pair against the market's configured `TOKEN`/`CURRENCY`. Off-pair intents that `validateOrder` rejects with `WrongTokens()` are executed anyway.
- **M-2 (MEDIUM)** — `Modification._propose` unconditionally overwrites a pending migration. A qualified (>10%) holder can silently replace the issuer's proposed termination with a migration to a successor contract of their choice; the entire wrapped base backing is then moved into that successor on execution.
- **M-3 (MEDIUM)** — `BridgedSharesUnderAgreement` inherits the permissionless-recovery flaw (pre-existing ③) on previously out-of-scope multichain surface. Remote-chain balances — including a dormant holder or the CCIP pool — can be seized after 184 days for a 0.01 ETH fee.

One candidate was investigated and **ruled out**: `SecondaryMarket.placeOrder` does _not_ dead-end on market-generated intents (the reactor's `verify` sees `msg.sender == market == intent.filler`), so no `InvalidFiller` bug exists there.

---

## Finding M-1 — `SecondaryMarket.process` clears off-pair trades that `validateOrder` rejects

**Files:** `market/SecondaryMarket.sol:254` (`process`), `market/SecondaryMarket.sol:159` (`validateOrder`), `market/TradeReactor.sol:118` (`process`)
**Severity:** MEDIUM
**Reproduced:** `AuditMarketSharesIntegrity.ts` → "Finding M-1"

**Description.** `validateOrder`/`executableAmount` enforce that an intent trades the market's configured pair — `(tokenOut == TOKEN && tokenIn == CURRENCY) || (tokenOut == CURRENCY && tokenIn == TOKEN)` — reverting with `WrongTokens()` otherwise (`SecondaryMarket.sol:161`). `process` (`SecondaryMarket.sol:254`) performs **no** pair check. It only relies on the reactor's cross-intent `TokenMismatch` checks (`TradeReactor.sol:121-122`), which hold for _any_ pair where `seller.tokenOut == buyer.tokenIn` and `seller.tokenIn == buyer.tokenOut`. Because `router` defaults to `address(0)` ("null for any", `SecondaryMarket.sol:53`), **any** caller can invoke `process` and clear off-pair intents through the issuer's market venue, where `validateOrder` reports them as invalid.

**Attack.** An attacker with two signed off-pair intents (e.g. an `XXX <-> SHARES` pair, both signed with `filler == market`) calls `market.process(...)`. `validateOrder` reverts with `WrongTokens()`, yet `process` transfers the tokens and emits a `Trade` event as if it were a market trade. The market's `tradingFeeBips` fee is collected on the off-pair execution, polluting the market's fee accounting with tokens outside its configured currency.

**Impact.** Broken venue invariant: the issuer's market can be used as a generic clearing venue for arbitrary token pairs, contradicting the `WrongTokens` guarantee its own validator enforces. No direct theft (both intents are signed, price match is verified), but the fee accounting and the `Trade` event stream become unreliable, and a malicious or compromised router (or any caller while `router == 0`) can route off-pair orders through the market.

**PoC.** `process` executes an `XXX <-> SHARES` pair through a `SHARES <-> CHF2` market (seller receives 148 shares after the 1.9% fee, buyer receives the 10 off-pair tokens) while the same intent reverts `validateOrder` with `WrongTokens()`; the control (same-pair intent) passes both.

**Fix** — enforce the pair in `process` exactly as `validateOrder` does:

```diff
  function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedAmount) external {
      if (!isOpen) revert MarketClosed();
      if (router != address(0) && msg.sender != router) revert WrongRouter(msg.sender, router);
+     if (!((seller.tokenOut == TOKEN && seller.tokenIn == CURRENCY) ||
+           (seller.tokenOut == CURRENCY && seller.tokenIn == TOKEN))) revert WrongTokens();
+     if (!((buyer.tokenOut == TOKEN && buyer.tokenIn == CURRENCY) ||
+           (buyer.tokenOut == CURRENCY && buyer.tokenIn == TOKEN))) revert WrongTokens();

      uint256 totalExecutionPrice = IReactor(REACTOR).getTotalExecutionPrice(buyer, seller, tradedAmount);
```

---

## Finding M-2 — `Modification._propose` silently overwrites a pending migration

**Files:** `shares/sha/Modification.sol:74-83` (`proposeMigration`/`_propose`), `shares/sha/Modification.sol:132` (`executeMigration`)
**Severity:** MEDIUM
**Reproduced:** `AuditMarketSharesIntegrity.ts` → "Finding M-2"

**Description.** `_propose` requires only that `msg.sender` be qualified (`isQualified` = the owner **or any holder with `> totalSupply()/10`**, `Modification.sol:125-127`) and then **unconditionally overwrites** the `migration` slot (`Modification.sol:80`). There is no "a migration is already pending" guard — in contrast to `DragAlong.offerAcquisition`, which reverts with `OfferPending` while an offer is live. A qualified holder can therefore silently replace any pending migration — including an issuer-proposed `proposeTermination()` — with their own `proposeMigration(successor)`, with no veto window and no overwrite-specific notice.

**Attack.** The issuer proposes a clean termination (`TYPE_TERMINATION`). A holder with >10% overwrites it with `TYPE_DEFAULT` to a successor contract they deployed. After the 20-day delay, `executeMigration` is permissionless (`Modification.sol:132`): the `TYPE_DEFAULT` branch approves the whole base balance to the successor and calls `successor.wrap(balance)` (`Modification.sol:136-138`), moving the **entire wrapped base backing** out of the wrapper into the holder-chosen successor, then terminates the token. Wrapped holders are left with claims on the holder's successor.

**Impact.** Governance hijack of the migration/termination process. Because the successor is fully under the proposer's control and `executeMigration` delivers 100% of the underlying backing to it, a >10% holder can redirect the issuer's termination into a migration that strips the backing from the remaining holders. The only protection is issuer vigilance (re-propose/cancel within the 20-day window) — the same vigilance-based model flagged in the DoS analysis for `DragAlong`.

**PoC.** 20 wrapped tokens held by one holder; the issuer proposes termination; the holder overwrites with `proposeMigration(attackerSuccessor)`; after 20 days anyone calls `executeMigration`, after which the wrapper holds 0 base, the successor holds all 20, and the wrapper is terminated with `base() == successor`.

**Fix** — do not allow overwriting a live proposal; require an explicit cancel first, mirroring `DragAlong`:

```diff
  function _propose(IERC20 successor, uint8 migrationType) internal returns (Migration memory) {
      if (!isQualified(msg.sender)) revert NotQualified();
+     if (migration.timestamp != 0) revert MigrationPending();
      migration = Migration({ successor: successor, timestamp: uint64(block.timestamp), migrationType: migrationType });
      emit MigrationProposed(msg.sender, successor, migrationType);
      return migration;
  }
```

(Alternatively, emit a dedicated overwrite event and restart the delay on any overwrite.)

---

## Finding M-3 — `BridgedSharesUnderAgreement` exposes permissionless recovery on remote-chain balances

**Files:** `multichain/BridgedSharesUnderAgreement.sol` (inherits `Recoverable`), `shares/base/Recoverable.sol:73-85` (`initRecovery`), `shares/base/Recoverable.sol:126-132` (`recover`)
**Severity:** MEDIUM (instance of pre-existing ③ on previously out-of-scope surface)
**Reproduced:** `AuditMarketSharesIntegrity.ts` → "Finding M-3"

**Description.** `BridgedSharesUnderAgreement` was not part of the original pashov scope, but it inherits the full `Recoverable` machinery. `initRecovery(address)` is permissionless — any caller can register a recovery naming themselves as recipient for **any** address with a non-zero balance, for a 0.01 ETH deterrence fee (`Recoverable.sol:77`). After the 184-day delay, `recover(lostAddress)` is also permissionless and transfers the victim's full balance to the attacker (`Recoverable.sol:126-131`).

On the bridged token this is materially worse than on the home token: the registered CCIP `pool` (`BridgedSharesUnderAgreement.sol:117`) and every remote-chain holder are plain addresses/contracts. The pool is a contract that **cannot call `cancelRecovery()` itself** — `cancelRecoveryOnOwnedContract` only works for contracts whose `owner()` is `msg.sender` (`Recoverable.sol:94-97`), and the pool's owner is the CCIP token admin, not the token's owner. The only cancellation path is the token owner manually calling `cancelRecovery(lostAddress)` (`Recoverable.sol:99`) within the 184-day window.

**Attack.** Pay 0.01 ETH, `initRecovery(victim)` for any remote-chain holder (or the pool), wait 184 days, `recover(victim)` — the victim's entire bridged balance is seized. In BurnMint topology the pool's standing balance is near zero, so the high-impact target is any dormant remote-chain holder; if a lock-release-style pool ever holds a material balance on this contract, the whole pool balance becomes seizeable.

**Impact.** Same class as pre-existing ③, newly reachable on the multichain surface where holders have no home-chain recovery monitoring and the pool cannot self-cancel. Mitigated only by issuer vigilance for 184 days.

**PoC.** A stranger registers a recovery on the bridged token's pool address (holding 1000) and, after 184 days + 0.01 ETH, seizes the entire 1000.

**Fix.** The same as pre-existing ③, which is confirmed relevant for the bridged token: gate `initRecovery` behind an opt-in proof-of-loss signal (e.g. the target address committing to a recovery, or a signed/off-chain attestation), and make the deterrence fee fail-closed (`require(success)` / `revert FeeTransferFailed`) instead of silently swallowing it.

---

## Ruled out — `SecondaryMarket.placeOrder` works for market-generated intents

**Files:** `market/SecondaryMarket.sol:143-146` (`placeOrder`), `market/TradeReactor.sol:144-148` (`verify`)
**Verdict:** not a bug — control test included.

`createBuyOrder`/`createSellOrder` produce intents with `filler == address(this)` (the market). `placeOrder` → `verifySignature` (`SecondaryMarket.sol:151`) → `IReactor.verify` (`TradeReactor.sol:144`). The reactor's filler check is `intent.filler != msg.sender && intent.filler != address(0)`; inside `placeOrder`, `msg.sender` to the reactor **is the market**, so `intent.filler == msg.sender` and the check passes. The earlier scratch hypothesis that `placeOrder` always reverts `InvalidFiller` was an ethers-Result arg-passing artifact, not a contract bug — confirmed by the passing control test.

---

## Findings list

| #   | Severity | Title                                                                                       | Reproduced                         |
| --- | -------- | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| M-1 | MEDIUM   | `SecondaryMarket.process` executes off-pair trades that `validateOrder` rejects             | ✅ `AuditMarketSharesIntegrity.ts` |
| M-2 | MEDIUM   | `Modification._propose` silently overwrites a pending migration (governance hijack)         | ✅ `AuditMarketSharesIntegrity.ts` |
| M-3 | MEDIUM   | `BridgedSharesUnderAgreement` inherits permissionless recovery (instance of pre-existing ③) | ✅ `AuditMarketSharesIntegrity.ts` |
| —   | N/A      | `SecondaryMarket.placeOrder` dead-end hypothesis — **ruled out**                            | control test                       |

## Relation to prior passes

- **M-3** shares a root cause with pre-existing finding ③ (pashov) / reentrancy ③; it is reported here because the bridged token was outside the original scope and the impact (pool cannot self-cancel, remote holders unprotected) is specific to that surface.
- **M-2** is distinct from the reentrancy-analysis D-2 (`executeMigration` CEI ordering) — this is a governance/proposal-integrity issue, not an ordering one. The D-2 fix recommendation (move `replaceBase`/`terminate` before the transfers) is orthogonal and still applies.
- **M-1** is distinct from pre-existing ① (filler-controlled fee) — this is a missing pair-validation gate, not a fee-schedule issue.

---

> ⚠️ This review was performed by an AI assistant. All three findings are reproduced by passing Hardhat PoCs; no claim of absolute security is made.
