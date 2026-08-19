# External Call Safety — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** External call safety sweep focusing on token integration, return values, and payment patterns

## Findings

### [F-1] DeterrenceFee: msg.value forwarded entirely to owner with no refund of excess

**Severity:** MEDIUM
**Location:** `contracts/utils/DeterrenceFee.sol:59-60`

```solidity
if (msg.value < fee) revert FeeMissing(fee, msg.value);
(bool success, ) = payable(owner).call{value: msg.value}("");
```

The function checks that `msg.value >= fee` but then forwards the **entire** `msg.value` to the owner, not just the `fee`. Any excess ETH sent is silently absorbed by the owner. While this is arguably by design (the caller chose to overpay), it violates the principle of least surprise and could lead to user confusion or griefing where an attacker front-runs a transaction by adding extra ETH to inflate the fee forwarded.

**Recommendation:** Consider forwarding only `fee` and refunding the excess to `msg.sender`, or document this behavior explicitly.

---

### [F-2] PaymentHub: payFromEtherAndNotify does not verify WETH swap success

**Severity:** MEDIUM
**Location:** `contracts/investment/PaymentHub.sol:121-123`

```solidity
weth.deposit{value: msg.value}();
swapToBaseCurrencyAndPay(directInvestment, priceInBaseCurrency, weth, msg.value, path);
```

`weth.deposit{value: msg.value}()` is a low-level call to the WETH contract. If WETH is not a valid contract (e.g., wrong path or upgradeable WETH that has been bricked), this call could fail silently or consume all gas. The WETH contract should be validated. Additionally, `swapToBaseCurrencyAndPay` uses Uniswap V3 `exactOutput` which could revert if the path is invalid, but this is caught by the overall transaction revert.

**Recommendation:** Validate `address(weth).code.length > 0` before calling deposit.

---

### [F-3] MultichainWallet: _refundRemaining uses unchecked low-level call

**Severity:** LOW
**Location:** `contracts/multisig/MultichainWallet.sol:131-135`

```solidity
function _refundRemaining(uint256 amount) internal {
    if (amount > 0) {
        payable(msg.sender).call{value: amount}("");
    }
}
```

The return value of the low-level call is not checked. If `msg.sender` is a contract that reverts on receive, the refund fails silently. The remaining ETH is stuck in the contract with no recovery path.

**Recommendation:** Use `Address.sendValue` or check the return value and emit an event.

---

### [F-4] MultichainWallet: _sync uses unchecked ERC20 transferFrom for fee token

**Severity:** LOW
**Location:** `contracts/multisig/MultichainWallet.sol:116`

```solidity
IERC20(message.feeToken).transferFrom(msg.sender, address(this), fee);
```

The return value of `transferFrom` is not checked (no `require` or `SafeERC20`). For tokens that return `false` on failure (rather than reverting), this silently fails. The `fee` amount is then approved to the router, but the tokens were never received.

**Recommendation:** Use `SafeERC20.safeTransferFrom` instead.

---

### [F-5] ERC20Allowlistable: auto-allowlisting trusts admin to whitelist arbitrary addresses

**Severity:** MEDIUM
**Location:** `contracts/ERC20/ERC20Allowlistable.sol:267-274`

```solidity
if (
    isAdmin(from)
    && amount != 0
    && address(to).code.length == 0
    && to != address(0)
) {
    _setFlag(to, FLAG_INDEX_ALLOWED, true);
    emit AddressTypeUpdate(to, TYPE_ALLOWED);
}
```

When an admin transfers tokens to a new address, that address is automatically allowlisted. This means any admin transfer (including `burn()` which transfers to `address(0)`) could have side effects. The `amount != 0` guard prevents zero-amount transfers from triggering this, which is correct. However, the `address(to).code.length == 0` check means contracts are never auto-allowlisted, which is correct behavior.

**Status:** No vulnerability found — the guards are sound. Documented for completeness.
