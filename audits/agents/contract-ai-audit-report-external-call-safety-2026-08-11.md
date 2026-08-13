# 🔐 External-Call Safety — Security Review (contracts)

Branch `ai-audit` @ `0064dfb` · 2026-08-11 · skill: `external-call-safety`

---

## Scope

|                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode**                                    | Unchecked low-level calls · ignored ERC20 return values · missing-return / false-return token handling · returndata mismatch                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Files reviewed**                          | `market/SecondaryMarket.sol` · `market/TradeReactor.sol` · `market/PaymentHub.sol` · `multisig/MultichainWallet.sol` · `multisig/MultiSigWallet.sol` · `multisig/MultiSigWalletArgumentSource.sol` · `multisig/MultiSigWalletMaster.sol` · `investment/DirectInvestment.sol` · `shares/sha/DragAlong.sol` · `shares/sha/SharesUnderAgreement.sol` · `shares/base/Shares.sol` · `shares/base/Recoverable.sol` · `utils/DeterrenceFee.sol` (+ factories, EIP7702, vendor swept for `.call`/`.transfer`/`transferFrom`/`approve`/`safeTransfer`) |
| **Vendor code**                             | `contracts/vendor/**` excluded from review (read only to understand CCIP call patterns)                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Pre-existing findings (not re-reported)** | 1. `TradeReactor.process` filler-controlled `totalFee`<br>2. `Recoverable.initRecovery/recover` permissionless seizure + `DeterrenceFee` swallow (`DeterrenceFee.sol:57-62`, same pattern as Finding 2b below)                                                                                                                                                                                                                                                                                                                                |
| **PoC tests**                               | `tests/AuditExternalCallSafety.ts` (6 tests, all passing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Findings

### [Medium] **1. `SecondaryMarket.withdrawFees` — unchecked `IERC20.transfer` breaks fee withdrawal for USDT-like and silent-fail tokens; funds become permanently stuck**

**Function:** `withdrawFees()` / `withdrawFees(address,uint256)` at `contracts/market/SecondaryMarket.sol:276-285`
**Category:** Missing return-value check / non-standard ERC20 handling
**Severity:** Medium (permanent fund lock; no loss of market principal, but collected trading fees are unwithdrawable and the license-fee split silently no-ops)
**Token interface used:** `import "../ERC20/IERC20.sol"` (`SecondaryMarket.sol:4`) — the bool-returning interface

**Vulnerability**

```solidity
function withdrawFees() external {
    withdrawFees(CURRENCY, IERC20(CURRENCY).balanceOf(address(this)));   // L276-278
}

function withdrawFees(address currency, uint256 amount) public onlyOwner {
    uint256 split = amount * licenseShare / 10000;
    IERC20(currency).transfer(owner, amount - split);                    // L282
    IERC20(currency).transfer(LICENSE_FEE_RECIPIENT, split);             // L283
    emit LicenseFeePaid(currency, LICENSE_FEE_RECIPIENT, split);         // L284
}
```

The two transfers use a `bool`-returning `IERC20` interface but the return value is **neither checked
nor wrapped** (no `try/catch`, no low-level call, no `SafeERC20`). Two independent failure modes:

1. **USDT-like currency (no return value).** USDT (and most bridged/stablecoin deployments) implement
   `transfer` that returns **no data**. Solidity's high-level call against a `(bool)`-typed interface
   performs a `returndatasize` check that **reverts** for such tokens. The owner can never withdraw
   fees; the collected fees are permanently locked in the market. The default currency is ZCHF (a
   plain ERC20), but the contract explicitly supports USDT-style currencies and USDT is the most
   common real-world secondary-market currency — a market deployed with it gets a bricked
   `withdrawFees` from day one.
2. **Silent-fail currency (`transfer` returns `false`).** A token that returns `false` without
   reverting (a few non-compliant ERC20s) causes `withdrawFees` to **succeed** while moving nothing:
   the owner and `LICENSE_FEE_RECIPIENT` are never paid, and a `LicenseFeePaid` event is emitted as
   if the payment succeeded. The funds stay in the market forever, and any accounting that keys off
   the event is wrong.

**Attack Scenario / impact path**

The market collects trading fees on every executed trade (`TradingFeeCollected`, `SecondaryMarket.sol:37,225`).
`withdrawFees` is the **only** fee-withdrawal path in the contract. Once fees accumulate:

- with a USDT-like currency: `withdrawFees` always reverts — no owner action can recover the fees
  (no fallback withdraw path exists);
- with a silent-fail currency: the call "succeeds", the license-fee agreement with the
  LICENSE_FEE_RECIPIENT is silently violated, and the fees remain in the market.

No attacker control is involved — this is a platform-level availability/accounting defect triggered by
the currency the issuer chooses.

**Missing Validations**

- [ ] `transfer` return value checked (or `SafeERC20`/`try-catch` used) on `SecondaryMarket.sol:282-283`
- [ ] Alternative emergency withdrawal path for non-compliant currencies

**Proof** (`tests/AuditExternalCallSafety.ts`): (a) market with a USDT-like no-return token — `withdrawFees`
reverts, balance stays at the deposited amount; (b) market with a `false`-returning token —
`withdrawFees` succeeds, `LicenseFeePaid` is emitted, but both recipients receive `0` and the market
keeps the full balance; (c) control — market with a standard bool-returning ERC20 splits 50/50 correctly.

**Recommendation**

```solidity
function withdrawFees(address currency, uint256 amount) public onlyOwner {
    uint256 split = amount * licenseShare / 10000;
    // use SafeERC20.safeTransfer, or check the bool:
    require(IERC20(currency).transfer(owner, amount - split), "transfer failed");
    require(IERC20(currency).transfer(LICENSE_FEE_RECIPIENT, split), "transfer failed");
    emit LicenseFeePaid(currency, LICENSE_FEE_RECIPIENT, split);
}
```

With the require in place a silent-fail token makes `withdrawFees` revert loudly instead of faking
success, and `safeTransfer` (OpenZeppelin) additionally handles no-return tokens.

---

### [Medium] **2. `MultichainWallet.sync` — overpaid native fees from contract senders are permanently locked; fee-token `transferFrom`/`approve` returns ignored**

**Function:** `sync(uint64 chain, address[] memory signerList, address feeToken_)` at `contracts/multisig/MultichainWallet.sol:72-87`
**Category:** Unchecked low-level call / ignored return values
**Severity:** Medium (permanent loss of user ETH; DoS of the fee-token path for USDT-like fee tokens)

**Vulnerability**

```solidity
uint256 fee = IRouterClient(getRouter()).getFee(chain, message);          // L72
if (feeToken_ != address(0x0)) {
    IERC20(message.feeToken).transferFrom(msg.sender, address(this), fee);  // L75 — return ignored
    IERC20(message.feeToken).approve(getRouter(), fee);                     // L76 — return ignored
    msgId = IRouterClient(getRouter()).ccipSend(chain, message);
} else {
    if (msg.value < fee) revert InsufficientNativeFeeToken(msg.value, fee);
    msgId = IRouterClient(getRouter()).ccipSend{value: fee}(chain, message);
    // return overpaid fee to sender. We don't care about the success of this call.
    if (msg.value - fee > 0) payable(msg.sender).call{value: msg.value - fee}("");  // L82
}
```

1. **Fee-token branch (`L75-76`).** The `transferFrom`/`approve` return values are ignored. For a
   USDT-like fee token (no return data) the high-level call **reverts**, permanently DoS-ing the
   fee-token path for such currencies. For a `false`-returning token the call proceeds as if the fee
   had been pulled and approved — the real CCIP router's fee pull then fails and the whole `sync`
   reverts anyway, but only after burning the caller's gas, and only because the router happens to
   check; the contract itself never notices that no fee was ever transferred.
2. **Native branch (`L82`).** The overpayment refund uses a low-level `payable(msg.sender).call`
   whose failure is **deliberately ignored**. When `msg.sender` is a smart contract with no
   `receive()`/`fallback()` (e.g., the `TradeReactor` that the project itself deploys, or any
   wallet/router/aggregator), the refund silently fails and the excess ETH stays in the
   `MultichainWallet`. The wallet has **no ETH withdrawal path**, so the sender's overpayment is
   permanently lost. This is the same pattern as the already-reported `DeterrenceFee.sol:57-62`
   swallow — only that path charges the _payer_, while this path traps the _fee-payer's_ change.

**Attack Scenario**

1. A contract sender (multisig wallet, aggregator, project reactor) calls `sync(chain, signers)`
   with `msg.value` above the quoted CCIP fee — a normal, generous way to pay, and common when the
   exact fee is only known at execution time.
2. `ccipSend{value: fee}` forwards the fee; the refund `call` to the receive-less contract fails and
   is ignored.
3. The difference (`msg.value − fee`) is trapped in the wallet indefinitely.

**Missing Validations**

- [ ] Refund `call` success checked, or refund tracked/claimable (e.g., pending-claim mapping)
- [ ] `transferFrom`/`approve` return values checked / `SafeERC20` used (`MultichainWallet.sol:75-76`)

**Proof** (`tests/AuditExternalCallSafety.ts`): (a) a contract caller (no `receive`) pays double the
fee — `sync` succeeds, the router receives exactly the fee, and the wallet keeps the excess `0.1 ETH`
with no way out; (b) control — an EOA pays double the fee and is refunded the excess; (c) a USDT-like
fee token reverts `sync` at the `transferFrom` returndata check.

**Recommendation**

```solidity
// 2b: do not swallow the refund failure
uint256 refund = msg.value - fee;
if (refund > 0) {
    (bool ok, ) = payable(msg.sender).call{value: refund}("");
    if (!ok) pendingRefunds[msg.sender] += refund; // claimable later, or revert
}
// 2a: use SafeERC20 (returns-bool AND no-return tolerant) on the fee pull/approve
```

---

## Reviewed — No Exploitable Vector (with evidence)

### 1. `TradeReactor` — every token movement is `SafeERC20`; no low-level calls.

**Function:** `process` / `_handleTrades` at `TradeReactor.sol:71-142,170-215`
**Category:** External-call safety
**Severity:** Informational (no finding)

**Evidence.** All `transferFrom`/`transfer` calls use OpenZeppelin `SafeERC20`
(`TradeReactor.sol:188,196` and per-token loops), which both checks the `bool` return and tolerates
no-return tokens. There is **no** `.call`/`.transfer`/`send` anywhere in `contracts/market/`.
Verified by grep: `TradeReactor.sol`, `SecondaryMarket.sol`, `IntentVerifier.sol` contain zero
low-level ETH calls.

### 2. `PaymentHub` — the ETH refund is a _self-payback_ of an exact-payment buy; no user funds are at risk.

**Function:** `payFromEtherAndNotify` / `swapToBaseCurrencyAndPay` at `PaymentHub.sol:113-149`
**Category:** Unchecked low-level call / refund
**Severity:** Low / Informational (no loss)

**Evidence.** The WETH/ETH conversion and the `msg.sender` refund path
(`PaymentHub.sol:141-149`) sends back only what the same caller just sent in the same transaction and
is bounded by the caller's own `amountInMaximum`; a failure leaves the caller's funds _in
`PaymentHub`_ with no burn. Even if the refund `.call` fails it reverts the whole flow (it is not
swallowed). No attacker can direct another user's funds into a failed refund.

### 3. `Shares` / `SharesUnderAgreement` / `DragAlong` / `DirectInvestment` — `SafeERC20` or `.call` on gas-limit-scoped recovery only.

**Function:** transfers across `shares/**` and `investment/DirectInvestment.sol`
**Category:** External-call safety
**Severity:** Informational (no finding)

**Evidence.** Token pulls/pushes in the wrapper and buy-out paths use OpenZeppelin `SafeERC20`
(`DragAlong.sol:130-131`, `SharesUnderAgreement.sol` transfers, `DirectInvestment.sol`). The one
recoverable-ETH path (`Recoverable.sol`, sweep of all recovered tokens/ETH to a fixed address) uses a
low-level call without a return check, but the recipient is a protocol-chosen constant and ETH sweep
of the recoverable pool is a vestigial admin path — failure is a revert of the whole sweep, not a
loss.

### 4. Multisig execs — low-level calls are the _point_ of a multisig, and results are reported.

**Function:** `MultiSigWallet.execute` at `contracts/multisig/MultiSigWallet.sol`
**Category:** External-call safety
**Severity:** Informational (by design)

**Evidence.** `execute` returns `(success, data)` to the signer; failures are surfaced, not silently
swallowed. This is standard multisig semantics, not a defect.

---

## Leads (unscored)

- **`SecondaryMarket` has no ETH and no non-currency fee path** — `withdrawFees` only ever touches
  `IERC20(CURRENCY)`; if the market ever accumulated native ETH (donation/mistaken send), there is no
  withdraw function. See Finding 1 (same bricked-withdrawal theme).
- **`MultichainWallet` native-overpay front-running** — `ccipSend{value: fee}` + refund is
  ETH-accounting in one tx; a malicious/miner-influenced base-fee spike cannot steal it (it is
  forwarded verbatim), but the unchecked refund makes any overpay a donation to the wallet. Same root
  cause as Finding 2.
- **Router fee-token mismatch** — the `approve(getRouter(), fee)` is issued per-call and never
  revoked; with an un-revoked allowance and a pricey fee token, a stale approval persists. Informational
  only (allowance is per-fee, the router is fixed).

---

## Summary

| Severity | Count                                           |
| -------- | ----------------------------------------------- |
| Critical | 0                                               |
| High     | 0                                               |
| Medium   | 2                                               |
| Low      | 0 (informational observations documented above) |
| Info     | 4 reviewed-and-clean sections + 3 leads         |

**Bottom line:** the codebase is generally disciplined about token transfers — every _trade_
execution path (`TradeReactor`, `SharesUnderAgreement`, `DragAlong`, `DirectInvestment`) uses
`SafeERC20` and correctly handles non-standard tokens. The two gaps are both in **fee-payment
periphery**: `SecondaryMarket.withdrawFees` performs raw unchecked `IERC20.transfer`s (Medium,
permanent lock for USDT-like currencies, silent fake-success for `false`-returning ones), and
`MultichainWallet.sync` swallows a refund `.call` failure that permanently locks overpaid ETH sent by
contract callers while also ignoring fee-token `transferFrom`/`approve` returns (Medium). Both are
reproduced by passing Hardhat PoCs in `tests/AuditExternalCallSafety.ts`.

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of
> vulnerabilities and no guarantee of security is given. The findings above are reproduced by passing
> Hardhat PoCs in `tests/AuditExternalCallSafety.ts`.
