# 🔐 Oracle & Flash-Loan Analysis — Security Review (contracts)

Branch `ai-audit` @ `0064dfb` · 2026-08-11 · skill: `oracle-flashloan-analysis`

---

## Scope

|                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode**                                    | Oracle source identification · validation verification · flash-loan atomicity · balanceOf/donation attacks · circular dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Files reviewed**                          | `investment/DirectInvestment.sol` · `investment/PaymentHub.sol` · `investment/IUniswapV3.sol` · `investment/IDirectInvestment.sol`<br>`market/TradeReactor.sol` · `market/SecondaryMarket.sol` · `market/SecondaryMarketFactory.sol` · `market/IntentHash.sol` · `market/IntentVerifier.sol` · `market/IReactor.sol`<br>`shares/sha/SharesUnderAgreement.sol` · `shares/sha/DragAlong.sol` · `shares/sha/Modification.sol` · `shares/base/Shares.sol` · `shares/base/Recoverable.sol`<br>`ERC20/ERC20Allowlistable.sol` · `utils/DeterrenceFee.sol` (+ multichain, factories, EIP7702, multisig swept for oracle reads) |
| **Vendor code**                             | `contracts/vendor/**` excluded from review (only read to understand CCIP call patterns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Pre-existing findings (not re-reported)** | 1. `TradeReactor.process` filler-controlled `totalFee`<br>2. `ERC20Allowlistable._beforeTokenTransfer` burn corrupts address(0) allowlist<br>3. `Recoverable.initRecovery/recover` permissionless seizure + `DeterrenceFee` swallow                                                                                                                                                                                                                                                                                                                                                                                     |
| **PoC tests**                               | `tests/AuditOracleFlashloanAnalysis.ts` (3 tests, all passing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

---

## Phase 1 — Oracle Dependency Map

Every external price/value read in the project contracts, and what it feeds:

```
PaymentHub.sol:L83  getPriceInPaymentCurrency()
├── uniswapV3Quoter.quoteExactOutput(path, priceInBase)      ← SPOT (simulates against slot0/liquidity)
│       feeds → return value to caller (quote only)
│       feeds → NOT used by any on-chain limit/execution check
├── payFromOtherCurrencyAndNotify() / payFromEtherAndNotify()
│       swap via uniswapV3SwapRouter.exactOutput(...)          ← SPOT execution
│       limit → amountInMaximum (CALLER-SUPPLIED, not oracle-derived)
│       price → directInvestment.getBuyPrice(shares)           ← owner-set, no oracle
└── SharesUnderAgreement.sol:L169  convertToBase()
        amount * base.balanceOf(address(this)) / totalSupply() ← balanceOf() self-referencing
        feeds → unwrap() only (requireNonBinding)

TradeReactor / SecondaryMarket — NO external price source at all
        prices derived only from signed Intent amounts (pure arithmetic, getAsk/getBid)
```

**Sources found:** only two — Uniswap V3 **spot** (quoter/router, Trust Level 1) and
`base.balanceOf(address(this))` self-balance (Trust Level 5 self-referencing). There is
**no TWAP** (`observe()` is never called), no Chainlink feed, no `slot0()`/`getSqrtPriceX96()`
read in project code (only the quoter/router periphery internals do, off the review surface).

### Contract-by-contract verdict

| Contract                                    | Reads a price source?                                                        | Feeds a critical limit/price check?                                         | Verdict                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| `DirectInvestment`                          | **No**                                                                       | —                                                                           | no oracle dependency                      |
| `PaymentHub`                                | Yes — V3 spot (quoter)                                                       | **No** (quotes are informational; buy cap is caller-set; DI price is fixed) | no exploitable vector                     |
| `TradeReactor` / `SecondaryMarket`          | No                                                                           | —                                                                           | no oracle dependency                      |
| `SharesUnderAgreement.convertToBase`        | Yes — `balanceOf` backing ratio                                              | Only `unwrap` (post-termination), ratio provably pinned                     | no exploitable vector                     |
| `DragAlong.acceptOffer`                     | No price source, but see **Finding 1** (acquisition terms are caller-chosen) | —                                                                           | **Finding 1**                             |
| `SecondaryMarket.withdrawFees`              | `balanceOf(address(this))`                                                   | Only determines the owner↔license split of a donation                       | donation = gift to owner, not exploitable |
| multichain / factories / EIP7702 / multisig | None                                                                         | —                                                                           | no oracle usage (grep-verified)           |

---

## Findings

### [Medium] **1. `DragAlong.acceptOffer` — permissionless buy-out lets an attacker seize the entire underlying share backing for free (or for self-minted worthless tokens); the only guard is a vigilance-based 20-day veto**

**Function:** `DragAlong.acceptOffer()` at `contracts/shares/sha/DragAlong.sol:121-137`
**Category:** balanceOf()/self-referencing valuation + permissionless value extraction (adjacent to flash-loan/oracle theme)
**Severity:** Medium (exploit is unconditional once the offer is un-vetoed)
**Oracle Source:** `wrappedToken.balanceOf(address(this))` (`DragAlong.sol:128`) paired against `totalSupply()` (`DragAlong.sol:129`)
**Trust Level:** 5 (self-referencing) — but the vulnerability is not ratio manipulation; it is that the _entire_ backing is handed to a caller who sets both the price and the currency.

**Vulnerability**

The drag-along is the wrapper token's buy-out settlement. `offerAcquisition` (`DragAlong.sol:84`) is
permissionless and accepts **any** `currency` and **any** `pricePerShareE18` — including `0` and a
token the caller can mint at will. Nothing on-chain validates the offer. After the fixed
`DRAG_PROPOSAL_DELAY` (20 days), **anyone** can call `acceptOffer` and the wrapper:

```solidity
uint256 balance = wrappedToken.balanceOf(address(this));                          // L128 — the FULL backing
uint256 totalPrice = offer.pricePerShareE18 * totalSupply() / 10 ** 18;           // L129 — priced in offerer's currency
offer.currency.safeTransferFrom(address(offer.buyer), address(this), totalPrice); // L130 — pull offerer's tokens
wrappedToken.safeTransfer(address(offer.buyer), balance);                         // L131 — hand over EVERYTHING
replaceBase(offer.currency);                                                       // L133 — base := attacker token
terminate();                                                                       // L134 — holders may unwrap → get attacker token
```

Every wrapped token is backed 1:1 by the underlying security token (wrap/mintFromBase are strictly
1:1), so the wrapper normally holds the **entire** tokenized share capital. A hostile offerer
therefore acquires that entire position in exchange for tokens that are worthless by construction.
The holders (who never consented) are left with a claim on the offerer's token via the subsequent
`unwrap` → `convertToBase` path.

The only standing guard is the 20-day veto in `canCancelOffer` (`DragAlong.sol:110`): the **owner** or
any holder with `> totalSupply()/10` may cancel **before execution**. That is a vigilance control, not a
protocol control: an issuer that is offline (or a market where the veto quorum is not reached, or the
issuer itself is the hostile party) loses everything. This is structurally identical to the
pre-existing "permissionless recovery" finding, on the buy-out path. Additionally, because only one
offer slot exists and an offer blocks all others for 20 days, the same permissionless offer is a cheap
griefing/DoS lever (≈1 ETH deterrence per 20 days, see `deter(100)` at `DeterrenceFee.sol:55-64`).

**Attack Scenario**

1. Attacker deploys a mintable ERC20 `MINE` and mints themselves `T` units (or simply picks
   `pricePerShareE18 = 0`).
2. Attacker calls `offerAcquisition(MINE, pricePerShareE18, ...)` with the deterrence fee
   (~1 ETH, paid to the owner) — permissionless, no qualification.
3. Wrapper now holds the company's full share backing (`balance == totalSupply`). Owner/holders
   **do not cancel** within 20 days (offline issuer, non-quorum, or collusion).
4. Attacker (or anyone) calls `acceptOffer`. With `price = 0`: `totalPrice = 0`, no approval and no
   balance required — the wrapper transfers all `T` underlying shares to the attacker for free.
   With `price = 1 MINE/share`: attacker spends `T` self-minted `MINE`.
5. `replaceBase(MINE)` + `terminate()`: holders can only `unwrap` into `MINE`.
6. Net profit: the entire underlying share position of the company, for `0`–`0.01 ETH` cost plus the
   deterrence fee. No flash loan required (the 20-day delay actually _kills_ the flash-loan vector —
   this attack needs only patience and owner inaction).

**Missing Validations**

- [ ] Minimum price bound (`pricePerShareE18 > 0`, ideally a market-realistic floor)
- [ ] Currency sanity (reject self-mintable/unknown ERC20s, or require the currency to be a known/allowlisted feed-backed asset)
- [ ] Any on-chain circuit breaker (the veto must not be the _only_ control)
- [ ] Offer anti-griefing (only one offer slot, spammable)

**Proof** (`tests/AuditOracleFlashloanAnalysis.ts`): (a) price `0` — attacker receives all `1000`
underlying shares, wrapper left with `0` backing, `binding == false`, `base == MINE`; (b) price
`1 MINE/share` — attacker pays only self-minted tokens; (c) control — an attentive owner's
`cancelOffer` inside the window is the _only_ thing that blocks it.

**Recommendation**

- Gate the offer on an actual acquisition commitment: require `pricePerShareE18 > 0`, a minimum
  deterrence _forfeitable_ to holders (not refundable), and/or whitelist acceptable currencies.
- Reconsider single-slot offers: allow the current offer to be replaced by a _better_ offer, and
  charge the griefer meaningfully per spam attempt.
- Add an on-chain safety valve independent of the owner's vigilance (e.g., execution requires the
  buyer to have _sent_ the currency, or execution re-verifies a minimum price against a
  non-manipulable reference).

---

## Reviewed — No Exploitable Vector (with evidence)

The following are the primary focus areas of this audit. They were examined end-to-end and **no
manipulable price source feeds any critical pricing/limit decision** in them.

### 1. `DirectInvestment` — reads **no** oracle. Not a TWAP reader, not a spot reader.

**Function:** `getBuyPrice` / `processIncoming` / `deliverShares` at `DirectInvestment.sol:76-115`
**Category:** Oracle source identification
**Severity:** Informational (no finding)
**Oracle Source:** none
**Trust Level:** n/a (admin-set `price`/`increment` state, `DirectInvestment.sol:29-30`)

**Evidence.** `DirectInvestment` imports only `IDirectInvestment`, `Ownable`, `IERC20`, `SafeERC20`
(`DirectInvestment.sol:15-18`). It does **not** reference `IUniswapV3.sol` — the `observe()` TWAP
interface, `slot0()`/`getSqrtPriceX96()` spot reads do not appear anywhere in the contract or in the
project code (grep-verified). The share price is a scalar owned by the issuer (`setPrice`,
`DirectInvestment.sol:69`) and `getBuyPrice` is pure arithmetic on it. The on-chain buy path
(`processIncoming`, `DirectInvestment.sol:110`) enforces `amountBaseCurrency == getBuyPrice(shares)`,
so a buyer can never settle for less than the fixed price. No flash loan, donation, or pool
manipulation can change the price at which shares are sold; there is no `balanceOf(address(this))`
input to any pricing decision (the only `balanceOf` uses are the owner-only `migrate`,
`DirectInvestment.sol:136-137`).

### 2. `PaymentHub` — reads Uniswap V3 **spot** quotes, but they feed **no critical check**.

**Function:** `getPriceInPaymentCurrency` / `payFromOtherCurrencyAndNotify` / `payFromEtherAndNotify`
at `PaymentHub.sol:79-149`
**Category:** Oracle manipulation (spot), validation gap
**Severity:** Low / Informational (no path to protocol funds)
**Oracle Source:** `uniswapV3Quoter.quoteExactOutput` (`PaymentHub.sol:83`) — a Uniswap V3 quoter,
i.e. a **simulation against current pool spot state** (single-block manipulable), **not** a TWAP
(`observe()` is never used).
**Trust Level:** 1 (spot, flash-loan manipulable)

**Vulnerability / why it is not exploitable for protocol value.** `getPriceInPaymentCurrency` returns
the spot quote to the caller and is used by frontends; the actual buy path never consults it. In
`payFromOtherCurrencyAndNotify` (`PaymentHub.sol:99`) and `payFromEtherAndNotify`
(`PaymentHub.sol:113`) the exchange-rate risk sits entirely with the **buyer**:

- the DirectInvestment always receives exactly `getBuyPrice(shares)` of base via
  `exactOutput` (`swapToBaseCurrencyAndPay`, `PaymentHub.sol:134-149`) — the issuer's price is
  immutable in this flow and never touches the pool;
- the buyer's own `amountInMaximum` is the only cap on the input, and any unused remainder is
  refunded to the payer (`PaymentHub.sol:146-148`). A manipulated pool can at most consume the
  buyer's self-chosen cap (a sandwich/MEV cost shifted from the buyer to the pool), or revert;
- `checkPath` (`PaymentHub.sol:127-131`) validates only that the path starts with base and ends with
  the payment currency — middle hops (including attacker-deployed pools) are arbitrary, but a
  malicious path again only affects the payer's own conversion rate, never the DirectInvestment's
  proceeds.

A flash-loan "buy shares at a discount" scenario fails: the share price in base terms is fixed and
enforced by `processIncoming`, so pool manipulation cannot lower what the issuer receives. There is
also no circular dependency: the share token (whose price would matter) does not appear in any
on-chain pricing pool that the protocol reads.

**Missing Validations**

- [ ] TWAP or deadline-bounded pricing on the quote path (currently spot; no `observe()` TWAP)
- [ ] Staleness / deviation bounds on quotes (informational — UI should add slippage on `amountInMaximum`)
- [ ] Path validation of intermediate fee tiers / pools (currently only endpoint tokens are checked)

**Recommendation.** The buy path is safe as designed (fixed base price + caller-set cap). For buyer
protection, frontends must set `amountInMaximum` with slippage above the `quoteExactOutput` result;
optionally constrain allowed paths to curated, high-liquidity pools and add a `minOut`-style
re-check of the executed input.

### 3. `SecondaryMarket` / `TradeReactor` — intent pricing is pure signed arithmetic; no oracle.

**Function:** `TradeReactor.getAsk/getBid/verifyPriceMatch/getTotalExecutionPrice/process`
(`TradeReactor.sol:71-142`), `SecondaryMarket.process` (`SecondaryMarket.sol:254-263`)
**Category:** Oracle source identification
**Severity:** Informational (no finding)
**Oracle Source:** none — execution price is derived solely from the two EIP-712-signed `Intent`
amounts (`verifyPriceMatch` + creation-time tie-break, `TradeReactor.sol:94-104`), which are limit
orders, not market data.
**Trust Level:** n/a

**Evidence.** No external call reads price data anywhere in `market/` (grep-verified). The filler can
only pick _which_ signed intents to match and _how much_ to fill (`tradedTokens`); the unit price of
every fill is bounded by the signed bid/ask. Manipulating a Uniswap pool, donating tokens, or
flash-borrowing cannot change the execution price — the only filler-controlled knob is `totalFee`,
which is pre-existing Finding 1. The rounding quirk noted in `getAsk`/`getBid` (partial fills round
toward the intent owner) and the 1-token price-match check that rejects some perfectly-matched
odd-denomination orders are limit-order semantics, not oracle manipulation.

### 4. `SharesUnderAgreement.convertToBase` — `balanceOf`-based backing ratio, provably unprofitable to inflate.

**Function:** `convertToBase` / `unwrap` / `wrap` at `SharesUnderAgreement.sol:143-170`
**Category:** balanceOf() pricing / donation attack (ERC4626-style inflation)
**Severity:** Informational (no finding)
**Oracle Source:** `amount * base.balanceOf(address(this)) / totalSupply()` (`SharesUnderAgreement.sol:169`)
**Trust Level:** 5 (self-referencing)

**Vulnerability / why it is not exploitable.** The classic share-inflation (first-depositor +
donation) attack is structurally blocked here:

1. **While binding**, the ratio is _pinned to exactly 1_: `wrap` pulls `amount` base and mints
   `amount` wrapped 1:1 (`SharesUnderAgreement.sol:143-148`), and `mintFromBase` is the same flow.
   A donation inflates `balanceOf`, but `convertToBase` is used only by `unwrap`, which is gated by
   `requireNonBinding` (`SharesUnderAgreement.sol:162`) — so an inflated ratio cannot be _spent_
   during binding.
2. **After termination**, no new `wrap` is possible (`requireBinding`), so `totalSupply` and
   `balance` are frozen. `unwrap(a)` burns `a` and transfers `a·B/T`; the ratio `B/T` is invariant
   under unwraps (`(B − a·B/T)/(T − a) = B/T`), so every holder is paid the same constant
   per-token rate. A donation is therefore distributed pro-rata across all holders — the donator
   recovers only their own proportional share and always nets a loss. There is no rounding-based
   front-run either: while binding, `B == T` exactly, so `convertToBase` is lossless.

**Missing Validations**

- [ ] None required for security (the 1:1 pin + binding/unbinding split prevent all profit vectors)

### 5. Circular-dependency check

**Severity:** Informational (none exploitable)

The wrapper's own supply feeds no external pricing pool, the issuer's share price is a fixed scalar
and is not derived from any pool, and no protocol token appears as a pricing input to any oracle the
protocol reads. The only self-referential pricing (`convertToBase`) is pinned as shown above. The
closest to a circular chain is the drag-along (wrapper value = backing → backing is handed to the
offerer → holders compensated in the offer currency), which is Finding 1.

---

## Flash-Loan Feasibility Summary

| Vector                                                        | Possible in one tx? | Result                                                                                                                    |
| ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Manipulate a pool to buy shares below the fixed `getBuyPrice` | No                  | Price is owner-set and enforced by `processIncoming`; pool only affects buyer's own conversion rate                       |
| Donation to inflate `convertToBase` for a profitable `unwrap` | No                  | Ratio pinned 1:1 while binding; frozen & pro-rata after termination                                                       |
| Flash-borrowed drag-along buy-out                             | No                  | 20-day `DRAG_PROPOSAL_DELAY` makes the "loan" hold period infeasible — but patience + owner inaction suffices (Finding 1) |
| Filler price games in `TradeReactor`                          | Yes                 | Already covered by pre-existing Finding 1 (`totalFee`), the only filler-controlled price knob                             |

---

## Leads (unscored)

- **Quote→execute MEV surface on `PaymentHub` buyers** — `getPriceInPaymentCurrency` returns a spot
  quote and the purchase executes against the same spot pool; a sandwich can force the buyer's swap
  to consume up to their self-set `amountInMaximum`. The contract gives the buyer no protection
  beyond their own cap. Buyers should treat `amountInMaximum` as a hard slippage bound; consider a
  `maxAmountIn` sanity check relative to a non-manipulable reference.
- **Griefing DoS on the drag-along offer slot** — one permissionless offer blocks all legitimate
  offers for 20 days; cost ≈1 ETH deterrence (×100 in `deter(100)`). Cheap relative to deal size.
- **`payFromEtherAndNotify` refunds in WETH, not ETH** (`PaymentHub.sol:146-148`) — UX only; unused
  ETH is returned as WETH per the v12 changelog.
- **Partial-fill price rounding / cross-unit accounting in `TradeReactor`** — already flagged as a
  lead in the pashov review; re-confirmed here as non-oracle semantics (limit-order rounding), not a
  flash-loan vector.

---

## Summary

| Severity | Count                                                  |
| -------- | ------------------------------------------------------ |
| Critical | 0                                                      |
| High     | 0                                                      |
| Medium   | 1                                                      |
| Low      | 0 (informational oracle observations documented above) |
| Info     | 5 reviewed-and-clean sections + 4 leads                |

**Bottom line:** the primary focus contracts genuinely do **not** read a manipulable price source for
any critical decision — `DirectInvestment` has no oracle at all (owner-set fixed price, enforced
exact-payment), `PaymentHub`'s Uniswap V3 **spot** quoter feeds only informational quotes (the buy
path is capped by the payer's own `amountInMaximum` and always settles at the fixed base price), and
the secondary-market intent pricing is pure signed arithmetic. No flash-loan or donation vector was
found against these paths. The single exploitable finding is **`DragAlong.acceptOffer`** — a
permissionless buy-out in a caller-chosen (zero-priced or self-minted) currency that transfers the
entire underlying share backing, guarded only by a 20-day, vigilance-dependent veto
(Medium, reproduced by 3 passing PoCs).

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of
> vulnerabilities and no guarantee of security is given. The single finding above is reproduced by
> passing Hardhat PoCs in `tests/AuditOracleFlashloanAnalysis.ts`.
