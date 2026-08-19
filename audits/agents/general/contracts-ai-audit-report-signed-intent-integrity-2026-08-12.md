# Signed-Intent Integrity Analysis — Audit Report

- **Target:** Aktionariat contracts — branch `ai-audit` @ `0064dfb`
- **Date:** 2026-08-12
- **Method:** Focused review of the signed-intent and authorization surface: what a signed message guarantees on-chain (`TradeReactor` intents, `SecondaryMarket` orders) and what the multisig can be made to do without signatures (`MultiSigWallet.checkExecution`), plus cross-checking against the parallel findings streams to surface only genuinely new issues.
- **PoCs:** `tests/AuditSignedIntentIntegrityAnalysis.ts` (3 tests, all passing — run with `npx hardhat test tests/AuditSignedIntentIntegrityAnalysis.ts`)

## Findings

| #   | Severity | Title                                                                                                                                                                                                                                   | Status          |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| F1  | **Low**  | `MultiSigWallet.checkExecution` lets anyone run arbitrary code with the multisig as `msg.sender`; the sub-call's logs persist after the trailing revert (phantom events attributed to the multisig)                                     | Confirmed (PoC) |
| F2  | **Low**  | `SecondaryMarket.process` never enforces the seller's signed minimum `amountIn`; the fee is silently deducted from proceeds at execution and the owner can raise `tradingFeeBips` (up to 5%) to re-price every outstanding signed order | Confirmed (PoC) |

**Verified non-findings (screened, no report).** `Nonce`-based nonce handling in `MultiSigWallet` is sound — `isValidLowNonce` blocks `nonce == max` (`contracts/multisig/Nonce.sol`), and `flagUsed` was simulated against real sequences with no replay. `cancelIntent` requires `msg.sender` to be the intent's owner or filler, so open intents cannot be cancelled by a stranger (`TradeReactor.sol:150-153`).

---

## F1 (Low) — `MultiSigWallet.checkExecution`: permissionless arbitrary call as the multisig, with persistent logs

**Files:** `contracts/multisig/MultiSigWallet.sol:91-94`

```solidity
function checkExecution(address to, uint value, bytes calldata data) external {
    Address.functionCallWithValue(to, data, value);
    revert("Test passed. Reverting.");
}
```

**Guard intended.** This is a dry-run helper: it is supposed to tell the signers whether a transaction "would succeed if it was properly signed" — hence the final `revert`. The only comment on it is exactly that (line 89).

**Guard actually present.** `checkExecution` is `external`, has **no `authorized` modifier**, and takes fully attacker-controlled `(to, value, data)`. It executes the call with the multisig as `msg.sender` and then reverts. Two properties combine:

1. **The call runs with the multisig's authority.** Any contract that keys behavior off `msg.sender` (or off the multisig's balance/allowance) is exercised by the multisig. ERC20 `transfer`s from the multisig succeed (the sub-call returns `true`).
2. **The revert rolls back state but not logs.** On production clients (geth/erigon/etc.) the logs emitted by the sub-call are written to the receipt _before_ the outer revert and are **not** rolled back. The transaction is mined with `status 0` and its receipt still contains the sub-call's events.

**Impact.** A stranger can, in one permissionless transaction and with no signature and no state change, make the multisig appear to:

- transfer tokens (`Transfer(wallet, attacker, X)` events), even though balances never move;
- emit any event the called contract emits on the caller path (e.g. `Received` on ETH receipt, `Transacted`, governance votes, order placements).

Off-chain consumers that index event logs rather than balance diffs — block-explorer ERC-20 tabs, accounting/indexing services, off-chain governors — will record transactions the multisig never authorized. This is a classic "logs persist on revert" spoofing issue; the multisig has no way to opt out, and the function is specifically the one signers are _recommended_ to call before signing.

Severity is Low: no funds move and no state is corrupted on-chain; the impact is on off-chain consumers of the event stream, and the function is a debugging utility. It is still worth fixing because it is public, unconditional, and cannot be revoked.

**PoC.** `tests/AuditSignedIntentIntegrityAnalysis.ts` (Finding 1):

1. Mint 100 `Shares` to a freshly deployed `MultiSigWallet`.
2. A stranger calls `checkExecution(shares, 0, transfer(attacker, 50))` with no signature.
3. The tx is mined with `status 0x0`; the call trace shows the nested CALL `from == multisig`, `to == shares`, `selector 0xa9059cbb`, returning `true` — the transfer executed as the multisig before the trailing revert.
4. Balances are unchanged (state rolled back). (EDR/hardhat strips the logs of reverted txs from receipts; the EIP-1167-visible, EDR-independent proof of the mechanism is the nested-call trace. On geth/erigon the same run yields a receipt whose logs contain the phantom `Transfer`.)

**Fix.** Make `checkExecution` a `view` (it must not run state-changing code with the multisig as sender in a real transaction), or run the sub-call from a throwaway context that cannot emit persisting logs, or gate it behind the `authorized` modifier. At minimum, document that its logs are not authoritative and advise against keying off them.

---

## F2 (Low) — `SecondaryMarket.process`: seller's signed minimum `amountIn` is never enforced

**Files:** `contracts/market/SecondaryMarket.sol:254-262`, `contracts/market/TradeReactor.sol:137-138`

```solidity
// SecondaryMarket.sol:258-259
uint256 totalExecutionPrice = IReactor(REACTOR).getTotalExecutionPrice(buyer, seller, tradedAmount);
uint256 totalFee = totalExecutionPrice * tradingFeeBips / 10000;

// TradeReactor.sol:137-138
IERC20(sellerIntent.tokenIn).safeTransfer(sellerIntent.owner, totalExecutionPrice - totalFee); // net proceeds to seller
IERC20(sellerIntent.tokenIn).safeTransfer(msg.sender, totalFee); // fee to filler
```

**Guard intended.** A sell intent is `Intent(owner, filler, TOKEN, amountOut, CURRENCY, amountIn, ...)` — the seller signs a _minimum_ receive of `amountIn` ZCHF for `amountOut` tokens. `TradeReactor.verify` checks expiry and filler, and the `getAsk`/`getBid`/`verifyPriceMatch` machinery ensures the buyer pays at least the seller's price — but nothing enforces that the seller actually _receives_ `amountIn`.

**Guard actually present.** The market fee is deducted from the seller's proceeds after price matching:

- the buyer pays exactly `totalExecutionPrice` (their signed price is honored),
- the seller receives `totalExecutionPrice - totalFee` (their signed price is **not** honored — `amountIn` is a floor that the reactor never validates against what the seller nets).

Consequences:

1. **Full fill pays below the signed floor.** With the default 1.9% fee (`tradingFeeBips = 190`, `SecondaryMarket.sol:62`), a full fill of a "sell 100 for ≥ 1000 ZCHF" order pays the seller 981 ZCHF. `TradeReactor.process` is the only price check and it does not re-validate the seller's minimum after subtracting the fee.
2. **The fee is applied at execution time, not signing time.** `setTradingFee` (`SecondaryMarket.sol:104-107`) lets the owner raise the fee to 5% at any moment; every order signed and resting in the book is instantly re-priced below its signed floor without the seller's consent. The intent carries no fee term, so the seller's signature covers the pre-fee amount only.

The `createSellOrder` docstring acknowledges that "the tokenIn amount is reduced by the trading fee, which is always charged to the seller" (`SecondaryMarket.sol:120-121`), so a well-informed UI can price the fee in at order creation. What is missing is the on-chain counterpart: the signed `amountIn` floor is not the enforceable guarantee the intent format implies, and a fee change (including a compromised owner key) silently degrades every live signed order.

**PoC.** `tests/AuditSignedIntentIntegrityAnalysis.ts` (Finding 2):

1. Seller signs "sell 100 tokens for ≥ 1000 ZCHF"; buyer signs "buy 100 tokens for 1000 ZCHF".
2. `getTotalExecutionPrice` returns exactly 1000 ZCHF (the seller's signed minimum).
3. After `process`, the seller's balance increased by **981** ZCHF (1000 − 19 at the default 190 bips) — below the signed floor.
4. With `setTradingFee(500)`, the same signed order fills and the seller receives **950** ZCHF.

**Fix.** After computing `totalFee`, enforce the seller's floor against the net proceeds: require `totalExecutionPrice - totalFee >= sellerIntent.amountIn * tradedAmount / sellerIntent.amountOut` (or include the fee term in the signed intent, e.g. a maximum `feeBips` the seller accepts), and bound `tradingFeeBips` relative to outstanding orders or require re-signing when it changes.

---

## Cross-references to parallel findings streams

- F1 is **not** covered by any of the ten parallel reports. The reentrancy stream screened `checkExecution` only for reentrancy/ETH-loss ("always rolls back; no ETH leaves", `reentrancy-pattern-analysis` line 35) and missed the log-persistence spoofing angle. No other stream mentions it.
- F2 is **distinct** from the covered "filler-controlled `totalFee`" finding (known #1 / pashov H3 / scv 3 / market-shares F1): that finding is about `TradeReactor.process` taking `totalFee` from the caller with no cap when intents are routed directly. F2 is about the _market's own_ fee being silently taken from the seller's proceeds with no enforcement of the signed `amountIn` floor, and about owner fee changes retroactively re-pricing signed orders.
- Screened and rejected during this pass (do not report elsewhere): `Nonce` nonce mechanism (sound, simulated), `cancelIntent` third-party griefing (impossible — owner-or-filler only), `IntentVerifier` domain separator (per-reactor, per-chain, constructed at deployment — no replay).
