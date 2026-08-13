# 🔐 Reentrancy Pattern Analysis — Aktionariat share-token + secondary market

Branch `ai-audit` @ `0064dfb` · 2026-08-11

Skill: `reentrancy-pattern-analysis` (five variants: classic single-function, cross-function, cross-contract, read-only, ERC-777/1155/721 callback).

---

## Scope

|                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In scope**                                | `multisig/MultiSigWallet.sol` · `multisig/MultiSigWalletMaster.sol` · `multisig/MultichainWallet.sol` · `multisig/MultichainWalletArgumentSource.sol` · `multisig/MultiSigCloneFactory.sol` · `multisig/Nonce.sol` · `multisig/Rollout.sol`<br>`market/TradeReactor.sol` · `market/SecondaryMarket.sol` · `market/SecondaryMarketFactory.sol` · `market/IntentHash.sol` · `market/IntentVerifier.sol` · `market/IReactor.sol`<br>`investment/DirectInvestment.sol` · `investment/PaymentHub.sol` · `investment/IDirectInvestment.sol` · `investment/IUniswapV3.sol`<br>`shares/base/Shares.sol` · `shares/base/Recoverable.sol` · `shares/sha/SharesUnderAgreement.sol` · `shares/sha/DragAlong.sol` · `shares/sha/Modification.sol`<br>`multichain/BridgedSharesUnderAgreement.sol` · `multichain/CCIPAdministrable.sol`<br>`factories/*` (incl. `lib/`) · `EIP7702/*` · `utils/Ownable.sol` · `utils/Initializable.sol` · `utils/SafeERC20.sol` · `utils/DeterrenceFee.sol` · `utils/Deployment.sol` · `utils/Address.sol` · `utils/BytesLib.sol`<br>`ERC20/ERC20Allowlistable.sol` · `ERC20/ERC20Flaggable.sol` · `ERC20/ERC20Named.sol` · `ERC20/IERC20.sol` · `ERC20/IERC677*.sol` · `ERC20/ERC20Errors.sol` |
| **Out of scope**                            | `vendor/` (Chainlink code — only traced how project contracts call it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Pre-existing findings (not re-reported)** | ① `TradeReactor.process` filler-controlled `totalFee` · ② `ERC20Allowlistable._beforeTokenTransfer` burn→address(0) allowlist corruption · ③ `Recoverable.initRecovery/recover` permissionless seizure + ignored deterrence-fee return                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Bottom line

**No new exploitable reentrancy vulnerability was found.** After building a full call graph of every ETH transfer and token interaction, verifying CEI ordering for every state-write/external-call pair, and mapping cross-function / cross-contract / read-only / callback re-entry targets, every re-entry path is either (a) blocked by a state write performed _before_ the external call, or (b) unable to reach a profitable inconsistent-state window because the tokens involved are non-callback ERC-20s and the state that changes after an interaction is guarded or value-neutral.

Five genuine **CEI violations** exist (`wrap`, `deter` modifier, `acceptOffer`/`executeMigration`, `DirectInvestment.migrate`), but none is exploitable under the system's trust model — they are reported below as LOW / defense-in-depth items with the specific reasoning for each. **No tests were written** because the instructions require PoCs only for real, reproducible vulnerabilities, and none was found.

---

## 1. Call graph + CEI verification (per contract)

Legend: `✓` state fully settled before external call · `✗` state written after external call · `—` no shared state.

| Contract · Function                                                                       | External interactions                                                                                                                   | State writes                                                                             | CEI | Notes                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MultiSigWallet.execute` (L96-104)                                                        | `Address.functionCallWithValue(to,data,value)` — **arbitrary call/ETH** (L100)                                                          | `flagUsed(nonce)` (L99)                                                                  | ✓   | nonce consumed _before_ the call (v6 fix). Re-entry with same nonce → `"used"`.                                                                                                                                                  |
| `MultiSigWallet.setSigner` (L197)                                                         | none                                                                                                                                    | `power`, `signerCount`                                                                   | ✓   | `authorized` requires a 1-power signer _or the wallet itself_; an attacker's contract is never `msg.sender == address(this)`, so it cannot re-enter and grant itself signer power.                                               |
| `MultiSigWallet.checkExecution` (L91-94)                                                  | arbitrary call (L92) then unconditional `revert`                                                                                        | none                                                                                     | ✓   | always rolls back; no ETH leaves.                                                                                                                                                                                                |
| `MultichainWallet.sync` (L54-87)                                                          | `feeToken.transferFrom` (L75), `approve` (L76), `router.ccipSend` (L77/L80), **`payable(msg.sender).call{value: msg.value-fee}`** (L82) | none                                                                                     | ✓   | refund targets the caller's _own_ `msg.value`; no wallet state; re-entering `sync` re-charges the fee each time. Return value of the refund `.call` ignored → ETH can be stranded (see §4, defense-in-depth).                    |
| `MultichainWallet._ccipReceive` (L25-36)                                                  | none (state only)                                                                                                                       | `power`                                                                                  | ✓   | router-triggered; `_setSigner` only.                                                                                                                                                                                             |
| `TradeReactor.process` (L118-142)                                                         | `safeTransferFrom` ×2 (L132-133), `safeTransfer` ×3 (L136-138)                                                                          | `filledAmount[...] +=` ×2 (L126-127)                                                     | ✓   | both `filledAmount` writes precede all five token calls. Re-entering `process` with the same intent pair → `OverFilled`. Reactor's transient holdings are only movable via verified signed intents. (fee-theft = pre-existing ①) |
| `TradeReactor.cancelIntent` / `cleanupExpiredIntentData`                                  | none                                                                                                                                    | `filledAmount`                                                                           | ✓   | cannot overlap `process` (expiry checked in `verify`, L144-148).                                                                                                                                                                 |
| `SecondaryMarket.process` (L254-263)                                                      | `REACTOR.process`                                                                                                                       | none                                                                                     | —   | fee computed locally; no shared state on the market.                                                                                                                                                                             |
| `SecondaryMarket.withdrawFees` (L280-285)                                                 | `currency.transfer` ×2                                                                                                                  | none                                                                                     | —   | no balance bookkeeping to corrupt.                                                                                                                                                                                               |
| `SharesUnderAgreement.wrap` (L143-148)                                                    | `base.safeTransferFrom` (L144)                                                                                                          | `_mint` (L145)                                                                           | ✗   | interaction before effect — **Finding W-1 (LOW)**.                                                                                                                                                                               |
| `SharesUnderAgreement.unwrap` (L162-166)                                                  | `base.safeTransfer` (L165)                                                                                                              | `_burn` (L164)                                                                           | ✓   | burn settles supply _before_ the transfer; proportional redemption keeps the per-token rate constant during any callback (§4, Finding RO-1).                                                                                     |
| `SharesUnderAgreement.mintFromBase` (L155-157)                                            | → `wrap`                                                                                                                                | via `wrap`                                                                               | ✗   | same as W-1; `baseOnly` + `requireBinding`.                                                                                                                                                                                      |
| `DragAlong.offerAcquisition` (L84-89)                                                     | `deter(100)` fee `.call` (DeterrenceFee L60)                                                                                            | `latestOffer`                                                                            | ✗   | modifier call before body — **Finding D-1 (LOW)**.                                                                                                                                                                               |
| `DragAlong.acceptOffer` (L121-137)                                                        | `offer.currency.safeTransferFrom` (L130), `wrappedToken.safeTransfer` (L131)                                                            | `delete latestOffer` (L126) ✓ _before_; `replaceBase`/`terminate` (L133-134) ✗ _after_   | ✗   | — **Finding D-2 (LOW)**.                                                                                                                                                                                                         |
| `DragAlong.cancelOffer` / `canCancelOffer`                                                | none                                                                                                                                    | `latestOffer`                                                                            | ✓   | reads `totalSupply()/10`; no external call.                                                                                                                                                                                      |
| `Modification.executeMigration` (L132-155)                                                | `baseToken().approve` (L137), `successor.wrap(balance)` (L138), `base.migrate()` (L148), `base.burn(...)` (L151)                        | `delete migration` (L161) ✓ _before_; `replaceBase`/`terminate` (L139-140/152) ✗ _after_ | ✗   | same family as D-2 — **Finding D-2 (LOW)**.                                                                                                                                                                                      |
| `Modification._propose` / `proposeMigration` / `cancelMigration`                          | none                                                                                                                                    | `migration`                                                                              | ✓   | no interactions.                                                                                                                                                                                                                 |
| `Shares.migrate` (L156-161)                                                               | `successor.notifyBurned` (L160)                                                                                                         | `_transfer`+`_burn` (L158-159)                                                           | ✓   | successor notified only after balances and supply fully settled.                                                                                                                                                                 |
| `Shares.mintAndWrap` (L192-200)                                                           | `wrapper.mintFromBase` (L199)                                                                                                           | `mint`, `_approve`                                                                       | ✓   | all effects before the wrapper call.                                                                                                                                                                                             |
| `Shares.burn` (L226-229)                                                                  | none                                                                                                                                    | `_transfer`+`_burn`                                                                      | ✓   | (allowlist corruption = pre-existing ②).                                                                                                                                                                                         |
| `Recoverable.initRecovery` (L77-85)                                                       | `deter(1)` fee `.call` (DeterrenceFee L60)                                                                                              | `recoveries[lostAddress]` (L82)                                                          | ✗   | modifier call before body — **Finding D-1 (LOW)**.                                                                                                                                                                               |
| `Recoverable.recover` (L126-132)                                                          | none (token `_transfer` is internal, no hooks)                                                                                          | `delete recoveries` (L139, in `prepare`), balances via `_transfer`                       | ✓   | `prepare()` performs **no** external call; the recovery record is consumed before the transfer. (permissionless seizure = pre-existing ③)                                                                                        |
| `Recoverable.burn` (L119-124)                                                             | none                                                                                                                                    | `_burn`                                                                                  | ✓   | owner-gated.                                                                                                                                                                                                                     |
| `BridgedSharesUnderAgreement.mint`/`burn(uint256)` (L128-142)                             | none (pool-triggered)                                                                                                                   | `_mint`/`_burn`                                                                          | ✓   | `onlyPool`; no callback-capable token interaction. `recover()` inherited from `Recoverable` = pre-existing ③.                                                                                                                    |
| `DeterrenceFee.deter` (L55-64)                                                            | **`payable(owner).call{value:fee}`** (L60)                                                                                              | — (runs _before_ the guarded body)                                                       | ✗   | — **Finding D-1 (LOW)**.                                                                                                                                                                                                         |
| `DirectInvestment.deliverShares` (L86-93)                                                 | `token.safeTransfer` (L90)                                                                                                              | `price +=` (L89)                                                                         | ✓   | price bumped before share delivery.                                                                                                                                                                                              |
| `DirectInvestment.processIncoming`/`notifyTradeAndTransfer`                               | → `deliverShares`                                                                                                                       | via `deliverShares`                                                                      | ✓   | `onlyPaymentHub`/`onlyOwner`.                                                                                                                                                                                                    |
| `DirectInvestment.migrate` (L135-139)                                                     | `token/base.safeTransfer` ×2 (L136-137)                                                                                                 | `buyingEnabled=false` (L138)                                                             | ✗   | effect after interaction — **Finding D-3 (INFO)**.                                                                                                                                                                               |
| `PaymentHub.payFrom*` (L88-124)                                                           | `base/paymentCurrency.safeTransferFrom`, **Uniswap v3 `exactOutput`** (L144), `directInvestment.processIncoming`                        | none                                                                                     | —   | hub holds no balances between txs; Uniswap pool callback re-entry can only re-route the attacker's own funds; `processIncoming` is `onlyPaymentHub`.                                                                             |
| `PaymentHub.multiPay`/`withdrawToken`                                                     | token transfers                                                                                                                         | none                                                                                     | —   | no state.                                                                                                                                                                                                                        |
| `AuthorizedExecutor.execute` (L32-40)                                                     | **arbitrary `call{value}`** (L55)                                                                                                       | `contractNonce++` (L37)                                                                  | ✓   | nonce incremented before the call; same-nonce re-entry → `InvalidNonce`.                                                                                                                                                         |
| `ERC20Flaggable.transfer`/`transferFrom`/`_transfer`                                      | none (hook `_beforeTokenTransfer` is internal-only, no calls)                                                                           | balances, allowances                                                                     | ✓   | pure token accounting, no callbacks.                                                                                                                                                                                             |
| `ERC20Flaggable.transferAndCall` (L209-211)                                               | **`IERC677Receiver.onTokenTransfer`** (L210) — callback-capable                                                                         | balances (fully settled by `transfer` L210 first)                                        | ✓   | **correct** ordering: state updated before the callback, so a malicious recipient re-entering `transferAndCall`/`transfer` sees consistent balances.                                                                             |
| `FactorySource.deploy` / `FactoryDestination.deploy` / `TokenPoolService` / `CCIPService` | Chainlink infra + clone `initialize`                                                                                                    | implementation fields (owner-sourced, `onlyOwner`)                                       | ✓   | no fund-holding state; all calls after the relevant state.                                                                                                                                                                       |

---

## 2. Guard coverage verification

- **Reentrancy guards:** none of the in-scope contracts uses a `nonReentrant` modifier (grep confirms no `ReentrancyGuard` anywhere outside `vendor/`). Protection relies entirely on **CEI ordering**, which the table above verifies for every fund-moving path.
- **ETH-forwarding sites:** exactly four `payable(...).call{value}` / `call{value}` sites in project code — `MultiSigWallet.execute` (guarded by nonce), `MultichainWallet.sync` refund (no state), `DeterrenceFee.deter` (fee to fixed `owner`, before body), `AuthorizedExecutor.execute` (guarded by nonce). No classic ETH-drain pattern (balance read → send → balance write) exists anywhere.
- **Callback-capable tokens:** the only genuinely callback-capable entry in project code is `ERC20Flaggable.transferAndCall` (ERC-677 `onTokenTransfer`). It is invoked by **no** internal flow; and even when called directly it follows CEI (state first, callback last). The share tokens (Shares, SharesUnderAgreement, BridgedSharesUnderAgreement) implement plain ERC-20 `transfer`/`transferFrom` with no receiver hooks, so none of the withdrawal/redemption paths can be callback-re-entered.

---

## 3. Findings

### Finding: No exploitable reentrancy vulnerability in the current trust model

**Function:** all in-scope functions (see §1 table)
**Variant:** all five (classic / cross-function / cross-contract / read-only / callback)
**Severity:** N/A (explicitly **no vulnerability found**)
**Guard Status:** Guarded-by-CEI (no `nonReentrant` guards, none required for the fund-moving paths)

**Reasoning (per variant):**

1. **Classic single-function** — the only ETH `.call` sites with state (`MultiSigWallet.execute` L99, `AuthorizedExecutor.execute` L37) consume their nonce _before_ the call, so re-entry is replay-blocked. No function sends value or tokens before settling the accounting that its own checks read.
2. **Cross-function** — for every external call in F, every other function G that shares F's post-call state is either `onlyOwner`/`onlyPaymentHub`/`onlyPool` (Recoverable.burn, DirectInvestment, BridgedShares) or reads the already-settled variable (`TradeReactor.process` ↔ `cancelIntent`/`cleanupExpiredIntentData`, `DragAlong` ↔ `cancelOffer`). `DragAlong.acceptOffer` explicitly deletes `latestOffer` (L126) before interacting for this reason.
3. **Cross-contract** — the reactor holds seller/buyer tokens transiently, but every movement out of it requires freshly-verified signed intents; the transient balance cannot be consumed by a re-entering third party. `Recoverable.recover`/`burn` move tokens only via internal `_transfer`/`_burn` (no hooks), so no cross-contract stale-state window exists during the transfer.
4. **Read-only** — the only shared-rate view is `SharesUnderAgreement.convertToBase` (`amount * base.balanceOf(this) / totalSupply()`). During `unwrap`, the burn _precedes_ the transfer and redemptions are exactly proportional, so the rate `B/S` is invariant across any re-entrant unwrap chain (see Finding RO-1 below); no third-party pricing consumer of `convertToBase` exists in scope.
5. **ERC-777/1155/721 callback** — the share tokens have no receiver hooks. The one callback-capable primitive, `transferAndCall` (ERC20Flaggable L209-211), completes balance updates before invoking `onTokenTransfer`. `wrap`'s `safeTransferFrom` precedes `_mint` (violation, Finding W-1) but the base token is the issuer's non-callback `Shares` and is replaced only together with `terminate()`, so no profitable callback path exists.

**Impact:** none identified.

**Recommendation:** none required for correctness; see the defense-in-depth items in §4.

---

### Finding W-1 — `SharesUnderAgreement.wrap`: token pull happens before the mint (interaction-before-effect)

**Function:** `wrap(address,address,uint256)` at `SharesUnderAgreement.sol:143`
**Variant:** Classic (CEI violation) / callback (conditional)
**Severity:** LOW (not exploitable under the current trust model)
**Guard Status:** Unguarded (relies on `base` being a non-callback token)

**CEI Violation:**

- External call at L144: `base.safeTransferFrom(sender, address(this), amount)`
- State write AFTER the call at L145: `_mint(recipient, amount)`

**Re-Entry Path (theoretical):**

1. Attacker calls `wrap(attacker, amount)`.
2. If `base` were a callback-capable token, its `transferFrom` triggers a hook while the wrapper's `totalSupply()` and the recipient balance are **not yet** increased.
3. A re-entrant `wrap` would mint a second claim for the same base deposit (the Lendf.Me supply pattern, reference case study 5).

**Why it is not exploitable today:**

- While the wrapper is binding (the only regime in which `wrap`/`mintFromBase` run — `requireBinding`, L143/L155), `base` is the issuer's own `Shares` contract, a plain ERC-20 with **no** receiver/sender hooks (see §2). `Shares` only calls out on `transferAndCall`, which `wrap` never invokes.
- `base` can only be replaced via `DragAlong.acceptOffer` / `Modification.executeMigration`, and **both** pair `replaceBase` with `terminate()` in the same transaction — after which `wrap` is permanently disabled (`binding == false`). There is no reachable state where `base` is attacker-influenced while `wrap` remains enabled.
- Even if a hook fired, a re-entrant `wrap` pulls fresh base tokens from the caller and pays for them 1:1; there is no value to double-count.

**Impact:** none currently; latent if the trust model ever allowed a hook-capable `base` while `binding == true`.

**Recommendation:** reorder to effects-first:

```diff
-        base.safeTransferFrom(sender, address(this), amount);
         _mint(recipient, amount);
+        base.safeTransferFrom(sender, address(this), amount);
```

(State revert on failure makes this safe even if `_mint` were first.)

---

### Finding D-1 — `DeterrenceFee.deter`: ETH fee is forwarded to `owner` before the guarded function's effects

**Function:** `deter(uint16)` modifier at `DeterrenceFee.sol:55` (used by `Recoverable.initRecovery` L77 and `DragAlong.offerAcquisition` L84)
**Variant:** Classic (CEI violation) / cross-function
**Severity:** LOW (not exploitable)
**Guard Status:** Unguarded

**CEI Violation:**

- External call at L60: `(bool success, ) = payable(owner).call{value: fee}("")`
- State write in the _function body after the modifier_: `recoveries[lostAddress]` (Recoverable L82), `latestOffer` (DragAlong L86)

**Re-Entry Path:**

1. Attacker calls `initRecovery(lostAddress, attacker){value: 0.01 ETH}` (or `offerAcquisition{value: 1 ETH}`).
2. `deter` forwards the fee to `owner` **before** the recovery/offer record is written.
3. A malicious `owner` (owner is issuer-configurable) could re-enter during the fee call while `recoveries`/`latestOffer` are uninitialized.

**Why it is not exploitable:**

- Re-entering the _same_ guarded function still requires paying the fee again (`msg.value >= fee`), and the re-entrant call only writes its own record — the attacker gains nothing and the victim is whoever `lostAddress` points to, not the caller.
- Re-entering `recover(lostAddress)` while the record is unwritten → `RecoveryNotFound`. Re-entering `cancelRecovery()` → deletes `recoveries[msg.sender]` (= `owner`), irrelevant to the attacker.
- The attacker cannot _become_ `owner` mid-call (ownership changes are `onlyOwner`), so the `msg.sender != owner` fee-skip branch cannot be reached re-entrantly by an attacker.
- (The _ignored return value_ — a fee silently swallowed when `owner` cannot receive ETH — is the reentrancy-adjacent half of pre-existing finding ③ and is not re-reported here.)

**Impact:** none; the ordering is a latent hazard if a `receive()`-with-logic owner is ever configured.

**Recommendation:** emit/persist state before the fee forward, or make the fee transfer the final interaction:

```diff
 modifier deter(uint16 multiple) {
     if (deterrenceFee > 0 && msg.sender != owner) {
         uint256 fee = deterrenceFee * multiple;
         if (msg.value < fee) revert FeeMissing(fee, msg.value);
-        (bool success, ) = payable(owner).call{value: fee}("");
-        emit DeterrenceFeePaid(msg.sender, fee);
     }
     _;
+    if (deterrenceFee > 0 && msg.sender != owner) {
+        (bool success, ) = payable(owner).call{value: deterrenceFee * multiple}("");
+        emit DeterrenceFeePaid(msg.sender, deterrenceFee * multiple);
+    }
 }
```

---

### Finding D-2 — `DragAlong.acceptOffer` / `Modification.executeMigration`: `replaceBase`/`terminate` run after token interactions

**Function:** `DragAlong.acceptOffer` at `DragAlong.sol:121`; `Modification.executeMigration` at `Modification.sol:132`
**Variant:** Cross-function / cross-contract / read-only window
**Severity:** LOW (not exploitable)
**Guard Status:** Partially guarded (`latestOffer` / `migration` deleted before interacting; `binding`/`base` updated after)

**CEI Violation:**

- `acceptOffer`: interactions at L130-131 (`offer.currency.safeTransferFrom`, `wrappedToken.safeTransfer`) precede effects at L133-134 (`replaceBase(offer.currency)`, `terminate()`).
- `executeMigration`: interaction at L138 (`successor.wrap(balance)`) / L148 (`base.migrate()`) / L151 (`base.burn(...)`) precede `replaceBase`/`terminate`.

**Re-Entry Path:**

1. The buyer-chosen `offer.currency` is attacker-controlled; its `transferFrom` hook fires while `binding` is still `true` and `base` is still the old token.
2. Re-enter `acceptOffer` → `latestOffer` already deleted → `NoOfferFound`. Re-enter `unwrap` → `ContractBinding`. Re-enter `wrap` → requires base tokens + allowance from `msg.sender` (the token contract) and is value-neutral.
3. Read-only window: `convertToBase` reads `base` while it still points at the old token; but `unwrap` is disabled by `binding`, so the stale `base` cannot be redeemed during the callback.

**Why it is not exploitable:** every re-entry target that could touch value is blocked by the very state that is written _after_ the interactions (the deleted offer/migration record, and `binding == true`). The window closes as soon as `terminate()` runs, and nothing profitable can be done in it.

**Impact:** none; latent ordering hazard.

**Recommendation:** move `replaceBase(...)`/`terminate()` immediately after `delete latestOffer`/`delete migration` (before the transfers), since no interaction depends on the old `base`/`binding`:

```diff
         delete latestOffer; // clear the offer to prevent reentrancy
+        replaceBase(offer.currency); // make the purchase proceeds the new base
+        terminate(); // allow token holders to unwrap and collect proceeds

         uint256 balance = wrappedToken.balanceOf(address(this));
         uint256 totalPrice = offer.pricePerShareE18 * totalSupply() / 10 ** 18;
         offer.currency.safeTransferFrom(address(offer.buyer), address(this), totalPrice);
         wrappedToken.safeTransfer(address(offer.buyer), balance);
-        replaceBase(offer.currency);
-        terminate();
```

---

### Finding D-3 — `DirectInvestment.migrate`: `buyingEnabled` toggled after the token transfers

**Function:** `migrate(address)` at `DirectInvestment.sol:135`
**Variant:** Cross-function
**Severity:** INFO (not exploitable)
**Guard Status:** Unguarded

**CEI Violation:** transfers at L136-137 precede the effect `buyingEnabled = false` at L138. During the transfer window `deliverShares` still accepts `buyingEnabled`, but every caller of `deliverShares` is `onlyOwner`/`onlyPaymentHub`, and the migration itself is `onlyOwner` — a re-entrant buyer cannot reach `processIncoming`.

**Impact:** none.

**Recommendation:** set `buyingEnabled = false;` before the transfers.

---

### Finding RO-1 — Read-only window on `convertToBase` is rate-invariant (verified, not a vulnerability)

**Function:** `SharesUnderAgreement.unwrap` L162-166 / `convertToBase` L168-170
**Variant:** Read-only
**Severity:** N/A — verified safe

The classic Curve-style attack (reference case study 2) needs a rate that is _inflated_ mid-callback because `totalSupply` is decremented while `totalReserves` is not. Here the redemptions are strictly proportional: each `unwrap` burns `amount` wrapper tokens **before** transferring, so `convertToBase(amount) = amount · B/S` with both `B` and `S` shrinking together; over any re-entrant unwrap chain the ratio `B/S` is constant (`B(1−a/S)/(S−a) = B/S`). The window therefore cannot be used to extract more than the caller's proportional share, and no third-party consumer of `convertToBase` exists in scope. Confirmed safe.

---

## 4. Findings list

| #    | Severity | Title                                                                                                    | Reproduced                |
| ---- | -------- | -------------------------------------------------------------------------------------------------------- | ------------------------- |
| —    | N/A      | **No exploitable reentrancy vulnerability found** (all five variants analyzed, §3)                       | —                         |
| W-1  | LOW      | `SharesUnderAgreement.wrap` — token pull precedes `_mint` (interaction-before-effect)                    | no test (not exploitable) |
| D-1  | LOW      | `DeterrenceFee.deter` — ETH fee forwarded to `owner` before guarded-body effects                         | no test (not exploitable) |
| D-2  | LOW      | `DragAlong.acceptOffer` / `Modification.executeMigration` — `replaceBase`/`terminate` after interactions | no test (not exploitable) |
| D-3  | INFO     | `DirectInvestment.migrate` — `buyingEnabled` toggled after transfers                                     | no test (not exploitable) |
| RO-1 | N/A      | `convertToBase` read-only window verified rate-invariant (not a bug)                                     | —                         |

## 5. Pre-existing findings — reentrancy adjacency

- **Finding ① (`TradeReactor.process` fee theft)** is _not_ a reentrancy issue; the reentrancy-relevant ordering in `process` (both `filledAmount` writes at L126-127 before the five token transfers) is correct.
- **Finding ③ (permissionless recovery + fee swallow)** is the _external-call-safety_ half of the `DeterrenceFee.deter` analysis; its ETH-forward `(bool success, ) = ...` ignoring the return value is a different defect class (unchecked low-level call) from the CEI ordering discussed in D-1, which is why the two are kept separate.

---

> ⚠️ This review was performed by an AI assistant using the `reentrancy-pattern-analysis` methodology. No claim of absolute security is made. The three pre-existing findings in `test/AuditPoCs.ts` remain the only reproduced vulnerabilities on this branch; this review found no _additional_ exploitable reentrancy vector and therefore ships no new PoC tests.
