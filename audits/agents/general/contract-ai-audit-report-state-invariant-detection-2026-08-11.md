# State Invariant Detection — Audit Report

- **Target:** Aktionariat contracts — branch `ai-audit` @ `0064dfb`
- **Date:** 2026-08-11
- **Method:** State invariant audit over the value-bearing state machines — escrow/conservation laws, role-registry vs flag-registry consistency, and wrap/unwrap bookkeeping — verifying each law both as a positive invariant (does it hold on the legitimate path?) and as an exploit (can any entrypoint break it?).
- **PoCs:** `tests/AuditStateInvariantDetection.ts` (5 tests, all passing)

## Findings

| #   | Severity   | Title                                                                                                                                                                                                                                                                                                                 | Status          |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| F1  | **High**   | The wrapper's escrow-conservation law `base.balanceOf(wrapper) == wrappedSupply()` is broken by the base token's permissionless `Recoverable` recovery: any stranger drains the **entire** base escrow backing **all** wrapped holders; `unwrap()` then returns 0                                                     | Confirmed (PoC) |
| F2  | **Medium** | `BridgedSharesUnderAgreement` never reconciles the CCIP pool role with the `ERC20Allowlistable` flag registry; with restrictions applicable, every pool-minted holder is `ALLOWED` while the pool stays `FREE`, so the bridge-out transfer (holder → pool) permanently reverts — the whole bridge-out flow is bricked | Confirmed (PoC) |

Cross-references to the parallel findings streams: F1 is the deepest instance of known finding **#3** (`Recoverable.initRecovery`/`recover` permissionless, `contracts/shares/base/Recoverable.sol:73,126` — reported in `contracts-ai-audit-report-pashov-2026-08-11.md`, Finding 3, Medium). The prior reports covered the _holder-balance_ variant; F1 here reports the _escrow-conservation_ variant, which unbacks every wrapped token at once. The multisig signer-set desync (`MultichainWallet` out-of-order CCIP sync, `contracts/multisig/MultichainWallet.sol:66`) was already reported in `contract-ai-audit-report-signature-replay-analysis-2026-08-11.md` and is **not** re-reported here.

---

## F1 (High) — Permissionless recovery of the base token drains the wrapper escrow, breaking `escrow == wrappedSupply`

**Files:** `contracts/shares/base/Recoverable.sol:73,126` · `contracts/shares/sha/SharesUnderAgreement.sol:143-170` · `contracts/shares/base/Shares.sol`

**Invariant documented.** A `SharesUnderAgreement` wrapper holds the base tokens of every holder who wrapped. The 1:1 backing law is what makes `convertToBase` well-defined:

```
convertToBase(amount) = amount * base.balanceOf(wrapper) / totalSupply()     // SharesUnderAgreement.sol:169
```

For an unwrap to return the value the holder deposited, the wrapper's base balance must equal the wrapped supply. There is no second source of base, so this law must hold at all times.

**Invariant actually enforced.** `wrap`/`mintFromBase` and `unwrap` (`SharesUnderAgreement.sol:143-148,155-157,162-166`) keep the escrow and supply moving in lockstep — the positive path is sound (verified). But the wrapper _also_ inherits `Recoverable` from its base token: `initRecovery(address)` is **permissionless** (anyone names any address as "lost", 0.01 ETH deterrence, `Recoverable.sol:73`) and `recover(address)` is **permissionless** (`Recoverable.sol:126`). A stranger registers the **wrapper contract itself** as the lost address and, after `RECOVERY_DELAY` (184 days, `Recoverable.sol:47`), sweeps the entire escrow to themselves.

**Impact.** The conservation law is broken in one transaction: escrow drops to 0 while `totalSupply()` stays outstanding. Every wrapped token becomes worthless — `unwrap()` transfers `0` base (verified: `convertToBase(100) == 0` with supply 200). The wrapper's only public defense is `cancelBaseRecovery()` (`SharesUnderAgreement.sol:197`), which works **only if the issuer notices the attack within 184 days** and cancels in time. This is not limited to the SHA wrapper: every wrapper whose base token has permissionless recovery exposes its whole escrow the same way.

**Root cause.** Known finding #3 (permissionless `initRecovery`/`recover`, fee swallowed when the owner can't receive ETH). This report adds the invariant consequence: the same mechanism lets a stranger break the escrow conservation law of a **custodian contract**, i.e. the worst possible target for a recovery.

**PoC** (`tests/AuditStateInvariantDetection.ts`, "Finding 1 EXPLOIT"): after two holders wrap 200 base, `signer3` registers the wrapper for recovery, the clock advances past `RECOVERY_DELAY`, and `recover(wrapper)` transfers the full 200 base to `signer3` while `totalSupply()` stays 200 and `convertToBase(100)` returns 0.

**Remediation.** Gate `initRecovery` on an opt-in signal from the target (as in the known-#3 recommendation), and/or exclude custodian contracts (contracts holding balances on behalf of others, like wrappers and pools) from being recovery targets; add a time-windowed owner veto that also covers third-party custodian contracts.

---

## F2 (Medium) — Bridged pool role and allowlist flags are never reconciled; restrictions brick the whole bridge-out flow

**Files:** `contracts/multichain/BridgedSharesUnderAgreement.sol:117-142` · `contracts/ERC20/ERC20Allowlistable.sol:72-78,113-118,174-194`

**Invariant documented.** The bridged token "still governs [holders] through the shareholder agreement" (`BridgedSharesUnderAgreement.sol:49-50`), and the bridge-out flow is the standard CCIP `BurnMintTokenPool` sequence: the router transfers the tokens from the holder to the pool, then calls `burn(uint256)` on the pool's own balance (`BridgedSharesUnderAgreement.sol:135-138`). For that transfer to succeed, the **pool address must be allowed to receive** from every holder that bridges out.

**Invariant actually enforced.** The contract keeps **two orthogonal registries** that are never synchronized:

1. The CCIP pool role — `pool`, set by `setPool` (`BridgedSharesUnderAgreement.sol:117`). `setPool` writes **only** the pool variable; it does not touch the allowlist.
2. The allowlist flags — `typeFlag[address]`/`isAllowed` (`ERC20Allowlistable.sol:113-125`). The default type of any unconfigured address is `TYPE_FREE` (`isAllowed == false`).

No deployment or CCIP script configures the pool's flags (checked `scripts/`), so in practice the pool is permanently `FREE`. Meanwhile, once the owner enables restrictions via `setApplicable(true)` (`ERC20Allowlistable.sol:72`), the null address becomes `ADMIN`, so **every holder minted by the pool is auto-allowlisted** (`ERC20Allowlistable.sol:187-192`). The transfer rule matrix (`ERC20Allowlistable.sol:160-194`) forbids `ALLOWED → FREE`:

```
Allowlist_ReceiverNotAllowlisted(to)
```

**Impact.** With restrictions applicable (the documented mode), the holder → pool transfer that precedes every bridge-out **always reverts** for every holder — the entire bridge-out flow is bricked until the owner manually calls `setType(pool, TYPE_ALLOWED)`. Holders cannot return bridged tokens to the home chain (to unwrap or terminate), and the pool can never accumulate a balance to burn. Note this is asymmetric: bridge-**in** works (`pool.mint` auto-allowlists the recipient), bridge-**out** is what breaks. The failure is silent at deployment time — nothing warns the issuer that the two registries are inconsistent.

**PoC** (`tests/AuditStateInvariantDetection.ts`, "Finding 2 EXPLOIT"): after `setApplicable(true)`, the pool mints 100 to `signer2` (who is auto-allowlisted); the bridge-out `transferFrom(signer2, pool, 100)` reverts with `Allowlist_ReceiverNotAllowlisted(pool)`, and the pool balance stays 0. The control case (restrictions off) bridges out fine.

**Remediation.** In `setPool`, reconcile the registries: call `setTypeInternal(pool, TYPE_ALLOWED)` (and clear it on the old pool), or have `_beforeTokenTransfer` treat the registered `pool` as an allowed receiver unconditionally; alternatively assert in the migration/deploy scripts that the pool is `TYPE_ALLOWED` before enabling `setApplicable(true)`.

---

## Verified invariants (held)

Beyond the two breaks, the following state laws were checked and **hold** (PoCs in `tests/AuditStateInvariantDetection.ts`):

1. **Escrow conservation on the wrap path** — `mintAndWrap`/`mintFromBase` raises the base escrow and the wrapped supply by exactly the same amount; after two 100-unit wraps, `base.balanceOf(wrapper) == totalSupply() == 200` and `convertToBase(100) == 100`.
2. **Escrow conservation on the legitimate unwind path** — after a proper `proposeTermination` + veto delay + `executeMigration` (`TYPE_TERMINATION`, which terminates without touching tokens), `unwrap(50)` releases exactly 50 base, reducing escrow and supply by the same amount; `convertToBase` stays rate-invariant.
   - Contrast with `TYPE_CANCELLATION`, which intentionally burns the escrow — a design decision, not a bug.
3. **Bridged supply consistency** — pool `mint`/`burn` keep `totalSupply()` exactly tracking pool activity; the control case bridges out and burns cleanly when restrictions are off.
4. **Secondary-market accounting** — buyer pays `totalExecutionPrice`, seller receives `totalExecutionPrice - totalFee`, market receives `totalFee` (`TradeReactor.process`, `SecondaryMarket.sol:254-263`): no value is created or destroyed. (No change in this revision.)

## Exclusions (already reported elsewhere)

- **MultichainWallet out-of-order/stale signer sync** (destination signer set desyncs from source; `allowOutOfOrderExecution: true`, no sequence number) — `contract-ai-audit-report-signature-replay-analysis-2026-08-11.md` Finding 1.
- **`Shares` allowlist auto-set on ADMIN burns corrupting `address(0)`** (`typeFlag[0]` divergence) — pashov + scv reports.
- **`DragAlong` zero-price/unfunded offers** and **`DeterrenceFee` retained excess** — DoS/Griefing report F1/F2.
