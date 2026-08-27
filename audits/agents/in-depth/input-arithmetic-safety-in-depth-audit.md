# Input & Arithmetic Safety — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Input validation and arithmetic vulnerability sweep on in-scope contracts

## Findings

### [F-1] DragAlong: pricePerShareE18 has no upper bound validation

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/DragAlong.sol:60`

`offerAcquisition` accepts any `uint256 pricePerShareE18`. A buyer could submit an offer with an extremely high `pricePerShareE18` that causes overflow in `totalPrice` calculation at line 88:

```solidity
uint256 totalPrice = offer.pricePerShareE18 * totalSupply() / 10 ** 18;
```

If `pricePerShareE18 * totalSupply()` exceeds `type(uint256).max`, Solidity 0.8+ will revert. However, if `totalSupply()` is 0 (all tokens burned or no tokens minted), the division by `10**18` produces 0 regardless of `pricePerShareE18`, making the acquisition free.

**Recommendation:** Add `require(totalSupply() > 0)` in `acceptOffer` to prevent free acquisition when supply is zero.

---

### [F-2] DragAlong: convertToBase rounds down, potentially losing dust

**Severity:** LOW
**Location:** `contracts/shares/sha/SharesUnderAgreement.sol:172`

```solidity
function convertToBase(uint256 amount) public view returns (uint256) {
    return amount * base.balanceOf(address(this)) / totalSupply();
}
```

This division rounds down. For users with small balances, the rounding can cause them to receive 0 base tokens when unwrapping. This is standard behavior (rounding in favor of the contract) but should be documented.

**Status:** Informational only — standard rounding behavior.

---

### [F-3] PaymentHub: amountShares > 0 check does not prevent extremely small purchases

**Severity:** LOW
**Location:** `contracts/investment/PaymentHub.sol:89,100,114`

`require(amountShares > 0)` prevents zero-amount purchases but allows `amountShares = 1`. Combined with the linear pricing formula in `DirectInvestment.getBuyPrice`, a single share purchase could be very cheap, potentially allowing dust attacks or griefing through many small transactions.

**Status:** Informational — the pricing model handles this correctly via `increment`.

---

### [F-4] Modification: No validation that successor token implements required interface

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/Modification.sol:23`

`proposeMigration(IERC20 successor)` accepts any `IERC20` address. The `ISuccessor` interface (`wrap`) and `IMigratableBase` interface (`successor`, `migrate`, `burn`) are only checked at execution time (line 57-76). A proposal pointing to a non-functional contract will waste the 20-day delay before failing at execution.

**Recommendation:** Add an interface check in `_propose`, similar to how `Shares.setSuccessor` calls `successor.notifyBurned(address(0), 0)` as a sanity check.

---

### [F-5] Modification: executeMigration TYPE_DEFAULT calls approve with unlimited allowance

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/Modification.sol:57-60`

```solidity
uint256 balance = baseToken().balanceOf(address(this));
baseToken().approve(address(mig.successor), balance);
ISuccessor(address(mig.successor)).wrap(balance);
```

`approve` is called with `balance`, not `type(uint256).max`. This is correct — it approves exactly the amount needed. However, if `wrap()` reverts or does not consume the allowance, the remaining approval persists. After `replaceBase` and `terminate`, the old base token is no longer tracked, but the approval remains on the old token contract.

**Recommendation:** Revoke the approval after `wrap()` completes, or use `approve(address(mig.successor), 0)` after the wrap.
