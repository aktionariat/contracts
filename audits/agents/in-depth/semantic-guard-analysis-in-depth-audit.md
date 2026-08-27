# Semantic Guard Analysis — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Guard-state consistency analysis on the six in-scope attack surfaces

## Findings

### [F-1] DragAlong: offerAcquisition has deter(100) but acceptOffer has no fee

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/DragAlong.sol:60` vs `DragAlong.sol:85`

`offerAcquisition` requires a 100x deterrence fee (`deter(100)`), but `acceptOffer` has no fee at all. This creates an asymmetry: making an offer is expensive (discouraging spam), but accepting an offer is free. A shareholder can accept any offer without cost, which is correct behavior. However, the asymmetry means an attacker can make a zero-price offer (paying only the fee) and then wait for someone else to accept it for free.

**Status:** Design choice — the fee is on the offerer to prevent spam offers, not on accepters.

---

### [F-2] Modification: proposeMigration requires isQualified but cancelMigration also requires isQualified

**Severity:** LOW
**Location:** `contracts/shares/sha/Modification.sol:34,50`

Both `proposeMigration` and `cancelMigration` require `isQualified(msg.sender)`. This is consistent — the same privilege tier is required to propose and cancel. However, `cancelMigration` does not require the same `isQualified` check as `proposeMigration` for the owner (both check `holder == owner || balanceOf(holder) > totalSupply() / 10`).

**Status:** Consistent pattern — no guard bypass.

---

### [F-3] Modification: isQualified threshold (10% of supply) can be gamed with flash-loan-wrapped tokens

**Severity:** LOW
**Location:** `contracts/shares/sha/Modification.sol:65`

```solidity
function isQualified(address holder) public view returns (bool) {
    return holder == owner || (balanceOf(holder) > totalSupply() / 10);
}
```

An attacker could flash-borrow base tokens, wrap them into SHA tokens, and then call `proposeMigration` or `cancelMigration` in a single transaction. The `balanceOf` check reads the current balance, which includes flash-loaned tokens. However, the attacker would need to hold >10% of the total supply, which is expensive even with flash loans.

**Status:** Low risk — the cost of holding 10% of supply even briefly is significant.

---

### [F-4] DragAlong: canCancelOffer allows any holder with >10% supply to cancel

**Severity:** LOW
**Location:** `contracts/shares/sha/DragAlong.sol:78`

```solidity
function canCancelOffer(address holder) public view offerPresent returns (bool) {
    return holder == owner || balanceOf(holder) > totalSupply() / 10 || latestOffer.buyer == holder;
}
```

This is consistent with `isQualified` in `Modification.sol` — the same 10% threshold. The pattern is applied consistently across both contracts.

**Status:** No guard inconsistency.

---

### [F-5] ERC20Allowlistable: freeze/unfreeze bypass allowlisting but are owner-only

**Severity:** INFORMATIONAL
**Location:** `contracts/ERC20/ERC20Allowlistable.sol:65-71`

`freeze` and `unfreeze` are `onlyOwner` functions that set `TYPE_RESTRICTED` or the default type. These bypass the normal allowlisting flow but are restricted to the owner. This is a consistent pattern — admin functions are owner-gated.

**Status:** No guard inconsistency.
