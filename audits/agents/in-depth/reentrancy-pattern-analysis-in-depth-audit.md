# Reentrancy Pattern Analysis — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** CEI violation and reentrancy variant detection on in-scope contracts

## Findings

### [F-1] DragAlong: acceptOffer deletes state before external calls — correct CEI

**Severity:** INFORMATIONAL
**Location:** `contracts/shares/sha/DragAlong.sol:85-98`

```solidity
function acceptOffer() public offerPresent {
    checkExecution();
    IERC20 wrappedToken = baseToken();
    Offer memory offer = latestOffer;
    delete latestOffer;                          // EFFECT before INTERACTION
    uint256 balance = wrappedToken.balanceOf(address(this));
    uint256 totalPrice = offer.pricePerShareE18 * totalSupply() / 10 ** 18;
    offer.currency.safeTransferFrom(address(offer.buyer), address(this), totalPrice);
    wrappedToken.safeTransfer(address(offer.buyer), balance);
    replaceBase(offer.currency);
    terminate();
```

The `delete latestOffer` occurs before external calls. However, the `terminate()` and `replaceBase()` calls modify state AFTER external calls (`safeTransferFrom` and `safeTransfer`). If the `wrappedToken.safeTransfer` reverts, the state is not corrupted. But if `offer.currency.safeTransferFrom` succeeds and `wrappedToken.safeTransfer` reverts, the buyer's tokens are received but shares are not delivered.

**Status:** Low risk — `safeTransferFrom` and `safeTransfer` will revert on failure, so the entire transaction reverts atomically. No partial state corruption.

---

### [F-2] Modification: prepareExecution deletes migration before processing — correct CEI

**Severity:** INFORMATIONAL
**Location:** `contracts/shares/sha/Modification.sol:79-84`

```solidity
function prepareExecution() internal returns (Migration memory) {
    Migration memory mig = migration;
    if (mig.timestamp == 0) revert MigrationNotFound();
    if (block.timestamp < mig.timestamp + MIGRATION_PROPOSAL_DELAY) revert MigrationTooEarly(...);
    delete migration;  // EFFECT before INTERACTION
    return mig;
}
```

The `delete migration` occurs before `executeMigration` processes it. This is correct CEI — the migration is deleted before any external calls in the migration type handlers.

**Status:** No vulnerability.

---

### [F-3] Modification: executeMigration TYPE_DEFAULT calls external contracts after state changes

**Severity:** LOW
**Location:** `contracts/shares/sha/Modification.sol:57-63`

```solidity
if (mig.migrationType == TYPE_DEFAULT) {
    uint256 balance = baseToken().balanceOf(address(this));
    baseToken().approve(address(mig.successor), balance);
    ISuccessor(address(mig.successor)).wrap(balance);
    replaceBase(mig.successor);
    terminate();
}
```

The `approve` and `wrap` calls are external interactions. `replaceBase` and `terminate` are state changes that occur after these external calls. If `wrap` reverts, the entire transaction reverts (no partial state). If `wrap` succeeds but the successor is malicious, it could potentially call back into the contract. However, `replaceBase` and `terminate` do not have reentrancy guards, and the contract does not hold any state that would be exploitable during reentrancy at this point (the migration has been deleted, the base token is being replaced).

**Status:** Low risk — the contract state at this point is clean (migration deleted, balance transferred). Reentrancy would not yield additional funds.

---

### [F-4] DeterrenceFee: deter modifier sends ETH to owner — potential reentrancy

**Severity:** LOW
**Location:** `contracts/utils/DeterrenceFee.sol:60`

```solidity
(bool success, ) = payable(owner).call{value: msg.value}("");
```

The `deter` modifier sends ETH to the owner before the function body executes (the `_;` is after the ETH transfer). If the owner is a malicious contract, it could re-enter the function. However, the `deter` modifier is applied to external-facing functions, and re-entering would require paying the fee again.

**Status:** Low risk — re-entry would require paying the fee again, making it economically unattractive.

---

### [F-5] PaymentHub: multiPay has no reentrancy protection

**Severity:** LOW
**Location:** `contracts/investment/PaymentHub.sol:170-173`

```solidity
function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
    for (uint i=0; i<recipients.length; i++) {
        IERC20(token).safeTransferFrom(msg.sender, recipients[i], amounts[i]);
    }
}
```

Each `safeTransferFrom` could trigger a callback (if the token is ERC-777). During the callback, the attacker could call `multiPay` again with the same parameters. However, the `safeTransferFrom` pulls from `msg.sender`, so re-entry would require the attacker to have approved the contract for more tokens. This is not exploitable for fund theft.

**Status:** Low risk — re-entry would require additional approvals.
