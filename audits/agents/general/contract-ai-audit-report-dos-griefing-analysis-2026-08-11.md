# DoS & Griefing Analysis — Audit Report

- **Target:** Aktionariat contracts — branch `ai-audit` @ `0064dfb`
- **Date:** 2026-08-11
- **Method:** DoS & Griefing analysis (skill: `dos-griefing-analysis`). Seven-class sweep over permissionless entrypoints — unbounded loop DoS, external call failure DoS, insufficient-gas griefing (63/64), storage bloat, timestamp griefing, self-destruct force-feeding, block stuffing — across `contracts/shares/`, `contracts/utils/`, `contracts/market/`, `contracts/investment/`, `contracts/multichain/`, `contracts/multisig/`, `contracts/EIP7702/`. Focus on callers, costs, and reversibility per class.
- **PoCs:** `tests/AuditDosGriefingAnalysis.ts` (4 tests, all passing)

## Findings

| #   | Severity | Title                                                                                                                                                                                                                                                                                              | Status          |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| F1  | **High** | `DragAlong.offerAcquisition` — permissionless, price-unrestricted single global offer slot: (a) a zero-price offer seizes the entire base-token backing after the 20-day veto window; (b) an unfunded offer permanently bricks the drag-along mechanism (`OfferPending`) until issuer intervention | Confirmed (PoC) |
| F2  | **Low**  | `DeterrenceFee.deter` — excess `msg.value` over the required fee is silently retained by the token contract forever (no refund, no rescue path)                                                                                                                                                    | Confirmed (PoC) |

Scope notes: pre-existing findings proven in `test/AuditPoCs.ts` (TradeReactor filler-controlled `totalFee`; `ERC20Allowlistable` burn→`address(0)` allowlist corruption; Recoverable permissionless seizure + `DeterrenceFee` ignored `.call` return) are not re-reported here. F2 is distinct from the pre-existing "ignored return value" finding: it concerns `msg.value` _above_ `fee` being stranded, independent of whether the owner transfer succeeds.

---

## F1 (High) — DragAlong: zero-price offer seizes backing / unfunded offer bricks the mechanism

**Function:** `offerAcquisition()` at `contracts/shares/sha/DragAlong.sol:84` (slot write `:86`); `acceptOffer()` at `DragAlong.sol:121` (pull `:130`, transfer to buyer `:131`, `replaceBase` `:133`, `terminate` `:134`); `cancelOffer()` at `DragAlong.sol:101`; `canCancelOffer()` at `DragAlong.sol:110`
**Category:** External Call Failure DoS — single-slot state poisoning (reference Pattern 3.2 queue/slot poisoning; `acceptOffer`'s `safeTransferFrom` revert is Pattern 2.1 revert propagation). The zero-price seizure is the economic consequence of the same missing guard: no minimum-price check at offer submission.
**Severity:** High

**Issue:**

`latestOffer` is a single **global, mutually exclusive slot**. `offerAcquisition` (permissionless, any caller) enforces only `deter(100)` (1 ETH) and that the slot is empty (`OfferPending`, `DragAlong.sol:85`). It never validates:

1. **Price.** `pricePerShareE18` may be `0`. There is no minimum, and the buyer is not required to hold or approve any currency at offer time.
2. **Funding.** The buyer never escrows the currency; payment is pulled at execution (`safeTransferFrom`, `DragAlong.sol:130`) and priced at execution time (`DragAlong.sol:129`).
3. **Cancellability by the issuer.** `cancelOffer` is restricted to the owner, a `>10%` holder, or the buyer himself (`canCancelOffer`, `DragAlong.sol:111`). An issuer who holds ≤10% of the wrapped supply (as in the PoC, where 12 holders hold 1 token each) cannot cancel without cooperation from a `>10%` holder.

Two independent DoS/griefing outcomes follow:

**(a) Zero-price seizure.** An attacker submits an offer with `pricePerShareE18 = 0`. After `DRAG_PROPOSAL_DELAY` (20 days) elapses (`checkExecution`, `DragAlong.sol:114`), anyone — including the attacker — calls the permissionless `acceptOffer`. `totalPrice = 0`, so `safeTransferFrom` pulls nothing, the _entire_ base-token backing (`wrappedToken.balanceOf(this)`, `DragAlong.sol:128`) is transferred to the buyer (`:131`), and `replaceBase`/`terminate` flip the contract to non-binding with the attacker-chosen (possibly worthless) currency as the new base. Holders are left holding wrapped tokens whose backing they no longer control; `unwrap` (SharesUnderAgreement.sol:162) and `convertToBase` (SharesUnderAgreement.sol:168) now convert to the attacker's currency at zero/nominal value. The only protection is a veto during 20 days by the owner or a `>10%` holder — which may not exist (PoC: 12 × 1-token holders) or may not be monitoring.

**(b) Unfunded-offer bricking (DoS of the mechanism).** An attacker submits an offer with a non-zero price but never funds/approves the currency. `acceptOffer` always reverts at `safeTransferFrom` (`DragAlong.sol:130`); because the `delete latestOffer` (`:126`) is rolled back on revert, the poisoned slot survives. Every subsequent legitimate `offerAcquisition` reverts with `OfferPending` (`DragAlong.sol:85`), and the only remedy is the issuer noticing and calling `cancelOffer` — and the issuer must be able to (see issue 3). This bricks a company-critical acquisition path indefinitely.

**Growth/Cost Analysis:**

- No loops involved; this is a state-poisoning DoS, so the growth-relevant quantity is the **value at risk** vs. the fixed 1 ETH entry cost.
- Seized backing scales with `totalSupply()` and any wrapping that occurs during the 20-day window (priced at execution time, `DragAlong.sol:129`): the longer a company grows after the offer is placed, the more an attacker seizes for a fixed 1 ETH cost.
- Griefing ratio (mode b): attacker's sunk cost 1 ETH vs. blocked value of an acquisition that can be arbitrarily large → unbounded ratio, but reversible by the issuer, hence High rather than Critical.

**Attack Scenario:**

1. Attacker E deploys no special code; `E` calls `offerAcquisition(baseToken, 0, "")` with `value = 1 ETH` (`deter(100)` × 0.01 ETH), from an address with no token balance.
2. The 20-day veto window passes. The issuer (≤10% of supply) and the 12 small holders do not cancel (no `>10%` holder exists to veto).
3. Mode (a): `E` calls the permissionless `acceptOffer()`. `totalPrice = 0`, the full base backing transfers to `E`, and the SHA contract becomes non-binding (`binding == false`) with the attacker's currency as base. Holders can only unwrap into the attacker-chosen currency.
4. Mode (b): instead, `E` leaves the offer unfunded. Any legitimate buyer's `offerAcquisition` reverts `OfferPending`; `acceptOffer` always reverts. The drag-along is dead until the owner manually calls `cancelOffer("unblock")`.

**Cost to Attacker:**

- 1 ETH deterrence fee (sunk: forwarded to the owner/ledger, not refunded) + gas, per attempt. Mode (a) additionally yields the full base backing for free, so the attack can be _profitable_.
- No funds need to be escrowed or approved for mode (b).

**Impact on Victims:**

- Mode (a): **permanent fund loss** — the entire base-token backing is seized at zero cost; holders' wrapped shares lose their value; the acquisition executed without consideration. Not reversible on-chain.
- Mode (b): **permanent mechanism DoS** until external (issuer) intervention; all legitimate acquisition offers are blocked; the issuer may not even hold the right to cancel if they own ≤10% and no `>10%` holder cooperates.

**Recommendation:**

- Enforce a minimum meaningful price, e.g. `require(pricePerShareE18 > 0)` and/or a floor relative to the current base token's last known price, plus require the buyer to fund/approve the currency (or escrow it) **at submission**, not at execution.
- Make the issuer's veto unconditional: allow `owner` (or the issuer) to `cancelOffer` regardless of share balance, so a poisoned slot is always recoverable.
- Consider a per-offer expiry so an unfunded offer automatically lapses after the veto window instead of blocking the slot forever.

**Test mapping (all passing):** `tests/AuditDosGriefingAnalysis.ts`

- `"EXPLOIT: a zero-price offer seizes the entire base-token backing after the veto window"` → mode (a): 12 × 1-token holders (no `>10%` veto), `pricePerShareE18 = 0`, `acceptOffer` transfers all 12 base tokens to the attacker, `binding == false`. ✔
- `"EXPLOIT: an offer the attacker never funds bricks the drag-along mechanism"` → mode (b): `acceptOffer` reverts, slot survives, legitimate `offerAcquisition` reverts `OfferPending`, `cancelOffer("unblock")` restores. ✔
- `"control: a funded fair-price offer executes and pays the holders"` → buyer funded/approved 1000 base; pays 24, receives 12; `binding == false`. ✔

---

## F2 (Low) — DeterrenceFee: excess `msg.value` is silently retained by the token contract

**Function:** `deter` modifier at `contracts/utils/DeterrenceFee.sol:55` (fee computation `:58`, owner transfer `:60`, event `:61`); call sites: `DragAlong.offerAcquisition` (`deter(100)`), `Recoverable.initRecovery(address,address)` (`Recoverable.sol:77`, `deter(1)`)
**Category:** Self-Destruct Force-Feeding (adjacent flavor — ETH accumulates in the contract's balance with no accounting and no exit path; reference Class 6). No strict `address(this).balance` equality in these tokens, so the invariant-breaking variant of the class does not apply.
**Severity:** Low

**Issue:**

The `deter` modifier computes `fee = deterrenceFee * multiple` and forwards **only** that amount to `payable(owner).call{value: fee}` (`DeterrenceFee.sol:60`). If `msg.value > fee`, the surplus is neither refunded to the payer nor swept — it stays in the token contract (`Shares`, `SharesUnderAgreement`, `BridgedSharesUnderAgreement`). None of these contracts has an ETH withdrawal path: `Shares`/`SharesUnderAgreement` are ERC20 tokens whose only external balance operations are token-based (`recover` moves ERC20 balances), and `offerAcquisition`/`initRecovery` accept ETH purely as the fee. The retained ETH is therefore **permanently lost to the payer** with no recovery mechanism of any kind.

This is distinct from the pre-existing "ignored `.call` return value" finding: even when the owner transfer fully succeeds, the excess is still stranded.

**Cost Analysis:**

- Stranded amount = `msg.value − fee`, unbounded above (a payer sending 10 ETH loses 9.99 ETH). Realistic trigger: the caller must send the fee in a single `msg.value` and the fee multiple is caller-computed (`deterrenceFee * multiple`); integrators that hardcode a stale fee after `setDeterrenceFee` (DeterrenceFee.sol:66), or over-send out of caution, are silently drained of the difference.

**Attack Scenario:**

1. Payer sends `0.02 ETH` to `initRecovery(lostAddress)` (fee = 0.01 ETH, `deter(1)`).
2. The owner receives exactly `0.01 ETH`; the token contract's balance increases by the other `0.01 ETH`.
3. The token contract has no `withdraw`/`sweep`/refund path, so the `0.01 ETH` sits in the contract forever. The payer can never recover it.

**Cost to Attacker / Payer:** any amount above the required fee, permanently lost (plus gas).
**Impact on Victims:** permanent loss of the overpaid ETH for the payer; no protocol invariant is broken (hence Low), but the retention is silent — no event signals the surplus — so the loss is invisible until noticed off-chain.

**Recommendation:**

- Refund the excess: `require(msg.value == fee, "exact fee required")` (simplest), or return the surplus to the payer after the owner transfer, or keep an explicit `sweepExcessETH()`/pull refund. If exactness is chosen, revert with a clear error instead of silently accepting the surplus.
- Emit the surplus amount in `DeterrenceFeePaid` so accidental overpayment is at least observable.

**Test mapping (all passing):** `tests/AuditDosGriefingAnalysis.ts`

- `"EXPLOIT: paying 2x the deterrence fee strands the excess in the token contract forever"` → `initRecovery` with `0.02 ETH`; owner balance rises by exactly `0.01 ETH`; token contract balance rises by the remaining `0.01 ETH`. ✔

---

## Test evidence

```
tests/AuditDosGriefingAnalysis.ts
  F1(a): zero-price offer seizes the entire base-token backing after the veto window   ✔
  F1(b): unfunded offer bricks the drag-along mechanism until cancelOffer              ✔
  F1 control: funded fair-price offer executes and pays the holders                     ✔
  F2: excess msg.value (0.02 vs 0.01 ETH) retained by the token contract forever        ✔
4 passing
```

Re-run confirmation: `npx hardhat test tests/AuditDosGriefingAnalysis.ts` → **4 passing** (no recompilation needed; no transient cache-lock errors).
