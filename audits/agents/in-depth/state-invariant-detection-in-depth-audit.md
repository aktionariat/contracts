# State Invariant Detection — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** State-state invariant violation detection on the six in-scope attack surfaces

## Findings

### [F-1] DragAlong: acceptOffer changes base token without updating wrapped token balances

**Severity:** HIGH
**Location:** `contracts/shares/sha/DragAlong.sol:85-98`

When `acceptOffer` executes:
1. `replaceBase(offer.currency)` changes the `base` state variable to the new currency
2. `terminate()` sets `binding = false`
3. All existing SHA token holders now have tokens backed by a different base currency

The invariant broken is: **SHA token balance should be convertible to base token at a consistent rate.** After `replaceBase`, the `convertToBase` function in `SharesUnderAgreement.sol:172` reads `base.balanceOf(address(this))`, which now refers to the new currency. If the new currency has a different balance or value than the old one, the conversion rate changes for all holders.

**Impact:** All SHA holders' effective wealth changes to reflect the new base currency. This is by design (drag-along forces all holders to accept the acquisition), but it is a state invariant break that should be clearly documented.

**Recommendation:** Document that `acceptOffer` permanently changes the base token for all holders.

---

### [F-2] SharesUnderAgreement: unwrap rounds down, potentially creating orphaned base tokens

**Severity:** LOW
**Location:** `contracts/shares/sha/SharesUnderAgreement.sol:165-168`

```solidity
function unwrap(uint256 amount) external requireNonBinding {
    uint256 baseAmount = convertToBase(amount); // rounds down
    _burn(msg.sender, amount);
    base.safeTransfer(msg.sender, baseAmount);
}
```

`convertToBase` rounds down (`amount * base.balanceOf(address(this)) / totalSupply()`). After burning SHA tokens and transferring base tokens, the `base.balanceOf(address(this))` may have dust remaining due to rounding. Over many unwrap operations, this dust accumulates and is permanently locked in the contract.

**Invariant broken:** `base.balanceOf(address(this))` should equal the sum of `convertToBase(balance)` for all remaining SHA holders. Due to rounding, this is slightly off.

**Status:** Low — standard rounding behavior, dust is minimal.

---

### [F-3] BridgedSharesUnderAgreement: mint/burn do not validate amount > 0

**Severity:** LOW
**Location:** `contracts/multichain/BridgedSharesUnderAgreement.sol:66-70`

```solidity
function mint(address account, uint256 amount) external onlyPool {
    _mint(account, amount);
}

function burn(uint256 amount) external onlyPool {
    _burn(msg.sender, amount);
}
```

Zero-amount mints and burns are allowed. While these are no-ops for balances, they emit `Transfer` events and increment/decrement `totalSupply` (which stays the same for 0 amount). The `_beforeTokenTransfer` hook in `ERC20Allowlistable` is called with `amount = 0`, which means the auto-allowlisting check (`amount != 0`) prevents side effects.

**Status:** Informational — zero-amount operations are harmless due to the `amount != 0` guard.

---

### [F-4] Modification: executeMigration TYPE_CANCELLATION burns all tokens without checking individual balances

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/Modification.sol:69-72`

```solidity
} else if (mig.migrationType == TYPE_CANCELLATION) {
    IMigratableBase(address(baseToken())).burn(baseToken().balanceOf(address(this)));
    terminate();
}
```

This burns the entire base token balance held by the SHA contract. All SHA token holders lose their underlying base tokens. The SHA tokens remain but are no longer backed by anything (the contract is terminated).

**Invariant broken:** SHA token balance should be convertible to base tokens. After cancellation, `convertToBase` returns 0 for all amounts.

**Impact:** All SHA holders' tokens become worthless. This is by design (cancellation = company buyback/destruction), but the sudden loss of value should be documented.

**Recommendation:** Emit an event with the amount burned and ensure the cancellation process is well-documented in the terms.

---

### [F-5] ERC20Flaggable: balance storage uses upper 32 bits for flags — invariant between balance and flags

**Severity:** INFORMATIONAL
**Location:** `contracts/ERC20/ERC20Flaggable.sol:86,128,310-321`

The `_balances` mapping stores both the token balance (lower 224 bits) and flags (upper 32 bits). The `_checkAllowlistingFlagUnchanged` function ensures that balance changes do not corrupt flags. This is a carefully designed invariant that is correctly enforced.

**Status:** No vulnerability — the flag-balance invariant is properly maintained.
