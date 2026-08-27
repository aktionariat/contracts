# DoS & Griefing Analysis — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Seven-class DoS/griefing vulnerability sweep on the six in-scope attack surfaces

## Findings

### [F-1] DragAlong: Zero-price offer allows free acquisition of all wrapped shares

**Severity:** HIGH
**Location:** `contracts/shares/sha/DragAlong.sol:60-63` and `DragAlong.sol:85-98`

`offerAcquisition` accepts any `pricePerShareE18` value, including `0`. If a buyer submits an offer with `pricePerShareE18 = 0`, and the offer is not cancelled within 20 days (the `DRAG_PROPOSAL_DELAY`), any shareholder calling `acceptOffer()` will transfer all wrapped base tokens to the buyer at no cost. The `deter(100)` modifier requires a deterrence fee (100x the base fee) but this is a one-time payment for the offerer, not a per-share cost.

**Attack Scenario:**
1. Attacker calls `offerAcquisition` with `pricePerShareE18 = 0` and pays the deterrence fee.
2. Attacker waits 20 days without any shareholder calling `cancelOffer`.
3. Any shareholder (or the attacker themselves) calls `acceptOffer()`.
4. All base tokens are transferred to the attacker for free.

**Mitigation exists:** Shareholders can call `cancelOffer()` if they hold > 10% of supply, or if they are the owner. However, if no qualified holder acts within 20 days, the zero-price offer executes.

**Recommendation:** Add `require(pricePerShareE18 > 0, "Zero price")` in `offerAcquisition`, or allow any holder (not just >10%) to cancel a zero-price offer.

---

### [F-2] DragAlong: acceptOffer can be griefed by reverting token transferFrom

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/DragAlong.sol:91`

`offer.currency.safeTransferFrom(address(offer.buyer), address(this), totalPrice)` will revert if the buyer has not approved sufficient tokens. This means a buyer can make an offer, then deliberately fail the acceptance by not approving tokens, wasting the transaction of whoever calls `acceptOffer()`. The offer then remains until the 20-day delay expires or someone cancels it.

**Recommendation:** Consider requiring the buyer to deposit the full price upfront when making the offer (as escrow), rather than pulling at acceptance time.

---

### [F-3] Modification: cancelMigration can be griefed by qualified holders

**Severity:** MEDIUM
**Location:** `contracts/shares/sha/Modification.sol:50-53`

`cancelMigration()` can be called by any `isQualified` holder (owner or >10% supply). A single large holder can repeatedly cancel proposed migrations, preventing the contract from ever being migrated or terminated. This is a griefing vector if the migration is necessary for security reasons.

**Mitigation:** The owner can also call `cancelMigration()`, and the `isQualified` check is intentionally broad. However, a hostile >10% holder could indefinitely block migrations.

**Recommendation:** Consider adding a cooldown or expiration on cancellation, or allowing the owner to override a cancellation after a certain period.

---

### [F-4] PaymentHub: multiPay lacks array length validation

**Severity:** LOW
**Location:** `contracts/investment/PaymentHub.sol:170-173`

```solidity
function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
    for (uint i=0; i<recipients.length; i++) {
        IERC20(token).safeTransferFrom(msg.sender, recipients[i], amounts[i]);
    }
}
```

If `recipients.length != amounts.length`, the function will revert with an out-of-bounds error. This is not exploitable but is a usability issue. Additionally, zero-amount transfers are allowed, which waste gas.

**Recommendation:** Add `require(recipients.length == amounts.length)` and consider skipping zero amounts.
