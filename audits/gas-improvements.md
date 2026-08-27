# Gas Optimization Audit

**Date:** 2026-08-19
**Scope:** ERC20 token contracts, TradeReactor, SecondaryMarket, IntentHash
**Focus:** Functions called frequently across contract lifecycles (transfers, trade processing, signature verification)

---

## Executive Summary

This report identifies **15 gas optimization opportunities** across the codebase, organized by severity and estimated savings. The highest-impact findings are concentrated in `TradeReactor.process()` and the ERC20 transfer pipeline, which execute on every trade. Many findings involve redundant hash computations, unnecessary external calls, and SLOAD batching opportunities.

| Severity | Count | Estimated Avg. Savings |
|----------|-------|----------------------|
| High     | 5     | 3,000–15,000 gas     |
| Medium   | 6     | 500–3,000 gas        |
| Low      | 4     | 100–500 gas          |

---

## [G-01] Redundant `intent.hash()` Calls in `TradeReactor.process()`

**Severity:** High | **Estimated Savings:** ~8,000–12,000 gas per trade
**Location:** `contracts/market/TradeReactor.sol#L118-L142`

Each intent hash requires a full EIP-712 `keccak256(abi.encode(...))` with 9 fields plus a nested `keccak256(intent.data)`. In `process()`, each hash is computed **3 times** (lines 123, 126 for seller; lines 124, 127 for buyer) when only **1 cache** is needed.

```
L123: if (tradedTokens > (sellerIntent.amountOut - filledAmount[sellerIntent.hash()]))
L124: if (tradedTokens > (buyerIntent.amountIn - filledAmount[buyerIntent.hash()]))
L126: filledAmount[sellerIntent.hash()] += tradedTokens;
L127: filledAmount[buyerIntent.hash()] += tradedTokens;
```

**Fix:**
```solidity
function process(...) public {
    verify(sellerIntent, sellerSig);
    verify(buyerIntent, buyerSig);
    if (sellerIntent.tokenOut != buyerIntent.tokenIn) revert TokenMismatch();
    if (sellerIntent.tokenIn != buyerIntent.tokenOut) revert TokenMismatch();

    bytes32 sellerHash = sellerIntent.hash();
    bytes32 buyerHash = buyerIntent.hash();

    if (tradedTokens > (sellerIntent.amountOut - filledAmount[sellerHash])) revert OverFilled();
    if (tradedTokens > (buyerIntent.amountIn - filledAmount[buyerHash])) revert OverFilled();

    filledAmount[sellerHash] += tradedTokens;
    filledAmount[buyerHash] += tradedTokens;
    // ...
}
```

---

## [G-02] `verifyPriceMatch` Redundantly Recomputes Prices in `getTotalExecutionPrice`

**Severity:** High | **Estimated Savings:** ~1,500–2,500 gas per trade
**Location:** `contracts/market/TradeReactor.sol#L100-L104`

`getTotalExecutionPrice()` calls `verifyPriceMatch()` which computes `getAsk(sellerIntent, 1)` and `getBid(buyerIntent, 1)`. Then the function re-derives the price for the actual `tradedAmount`. The unit-price check only validates the sign relationship (bid ≥ ask); the full execution price is always recomputed.

```
L101: verifyPriceMatch(buyerIntent, sellerIntent);
L102: uint256 executionPrice = (sellerIntent.creation >= buyerIntent.creation)
          ? getBid(buyerIntent, tradedAmount)
          : getAsk(sellerIntent, tradedAmount);
```

**Fix:** Inline the price-match check and compute directly:
```solidity
function getTotalExecutionPrice(Intent calldata buyerIntent, Intent calldata sellerIntent, uint256 tradedAmount) public pure returns (uint256) {
    uint256 ask = getAsk(sellerIntent, 1);
    uint256 bid = getBid(buyerIntent, 1);
    if (bid < ask) revert OfferTooLow();

    return (sellerIntent.creation >= buyerIntent.creation)
        ? getBid(buyerIntent, tradedAmount)
        : getAsk(sellerIntent, tradedAmount);
}
```

---

## [G-03] `SecondaryMarket.process()` Redundant Hash Computation in Event

**Severity:** High | **Estimated Savings:** ~4,000–6,000 gas per trade
**Location:** `contracts/market/SecondaryMarket.sol#L277`

`SecondaryMarket.process()` calls `IReactor(REACTOR).process(...)` which already hashes both intents internally (even without G-01 fixed, the hashes are computed inside the reactor). Then the event emission on line 277 calls `seller.hash()` and `buyer.hash()` again — **2 more full EIP-712 hashes** that were already computed in the reactor.

```
L277: emit Trade(seller.owner, buyer.owner, seller.hash(), buyer.hash(), ...);
```

**Fix:** Have the reactor return the hashes, or accept them as parameters so they're computed once:
```solidity
// In SecondaryMarket.process():
bytes32 sellerHash = seller.hash();
bytes32 buyerHash = buyer.hash();
IReactor(REACTOR).process(seller, sellerSig, buyer, buyerSig, tradedAmount, totalFee, sellerHash, buyerHash);
emit Trade(seller.owner, buyer.owner, sellerHash, buyerHash, ...);
```

---

## [G-04] Unnecessary Double-Read in `ERC20Flaggable.transferFrom()`

**Severity:** Medium | **Estimated Savings:** ~2,100 gas per `transferFrom`
**Location:** `contracts/ERC20/ERC20Flaggable.sol#L177-L186`

`transferFrom()` reads `allowance(sender, msg.sender)` on line 179, then calls `_transfer()` on line 178 which invokes `_beforeTokenTransfer`. The `_beforeTokenTransfer` in `ERC20Allowlistable` reads `_settings` from storage to check the global pause flag. While not a double-read of the same slot, the `_transfer` → `_beforeTokenTransfer` path is always executed even when the contract is not paused and no flags are set — which is the **common case** for trade tokens.

More critically, the `allowance` function on line 149 is a **public function call** through the interface, which adds external call overhead (~2,600 gas for JUMP) even though it's called internally. This should use direct storage access.

**Fix:**
```solidity
function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
    _transfer(sender, recipient, amount);
    uint256 currentAllowance = _allowances[sender][msg.sender]; // direct storage read
    if (currentAllowance < INFINITE_ALLOWANCE) {
        _allowances[sender][msg.sender] = currentAllowance - amount;
    }
    return true;
}
```

---

## [G-05] Six SafeERC20 Wrapping Calls in `TradeReactor.process()`

**Severity:** High | **Estimated Savings:** ~3,000–4,500 gas per trade
**Location:** `contracts/market/TradeReactor.sol#L132-L138`

Every trade executes **6 SafeERC20 operations** (2 × `safeTransferFrom` + 4 × `safeTransfer`). Each SafeERC20 call goes through:
1. `abi.encodeCall()` — memory allocation + encoding (~200 gas)
2. `Address.functionCall()` — `isContract()` check with `extcodesize` (~2,600 gas)
3. Low-level `.call()` (~100 gas)
4. Return data decoding + length check (~200 gas)

**Total overhead: ~3,100 gas × 6 = ~18,600 gas** spent on SafeERC20 wrapping per trade.

Since the token addresses (`sellerIntent.tokenOut`, `buyerIntent.tokenOut`, `sellerIntent.tokenIn`) are validated by `SecondaryMarket.verifyTokenAndCurrency()` before reaching the reactor, and these are known ERC20 contracts (shares + currency), many of these checks are redundant.

**Fix:** For the internal `safeTransfer` calls (lines 136–138) where the reactor is transferring tokens it already holds, use a lighter wrapper or direct low-level calls with minimal checks:

```solidity
// Lightweight transfer for known ERC20 tokens
function _safeTransfer(IERC20 token, address to, uint256 value) internal {
    (bool success, bytes memory data) = address(token).call(
        abi.encodeWithSelector(token.transfer.selector, to, value)
    );
    if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
        revert SafeERC20FailedOperation(address(token));
    }
}
```

This eliminates the `isContract()` check (~2,600 gas) and `abi.encodeCall` overhead for each of the 4 `safeTransfer` calls, saving approximately **~10,400 gas**.

---

## [G-06] `ERC20Allowlistable._beforeTokenTransfer` — Pause Check on Every Transfer

**Severity:** Medium | **Estimated Savings:** ~2,600 gas per transfer (when not paused)
**Location:** `contracts/ERC20/ERC20Allowlistable.sol#L176`

The global pause flag is checked via `hasGlobalFlag(GLOBAL_FLAG_INDEX_PAUSED)` on **every single transfer**, including `transfer()`, `transferFrom()`, `_mint()`, and `_burn()`. This loads `_settings` from storage (slot 113) every time. In the vast majority of the token's lifecycle, the contract is not paused.

```
L176: if (hasGlobalFlag(GLOBAL_FLAG_INDEX_PAUSED)) revert TransfersPaused();
```

**Fix:** This is a design trade-off — the check is necessary for safety. However, consider using a more gas-efficient pattern if pause is rare:

Option A: Store the pause state in a dedicated `bool` at a predictable slot (cheaper SLOAD):
```solidity
bool private _paused; // slot X, single byte SLOAD

function _beforeTokenTransfer(...) internal virtual override {
    if (_paused) revert TransfersPaused();
    // ...
}
```

Option B: If the token is never expected to be paused in production, consider making the pause check conditional or removing it (with appropriate governance safeguards).

---

## [G-07] `SecondaryMarket.executableBuyAmount()` — Multiple External Calls per Intent

**Severity:** Medium | **Estimated Savings:** ~10,000–15,000 gas for batch queries
**Location:** `contracts/market/SecondaryMarket.sol#L238-L251`

`executableBuyAmount()` makes **4 external calls** per intent:
1. `IReactor(REACTOR).getFilledAmount(intent)` — external call (~2,600 gas)
2. `IReactor(REACTOR).getBid(intent, 1)` — external call (~2,600 gas)
3. `IERC20(intent.tokenOut).balanceOf(intent.owner)` — external call (~2,600 gas)
4. `IERC20(intent.tokenOut).allowance(intent.owner, REACTOR)` — external call (~2,600 gas)

When called via `executableAmounts()` for batch queries, this multiplies by the number of intents.

**Fix:** Create a batch-aware view function on the reactor that returns multiple filled amounts in one call:
```solidity
// In IReactor:
function getFilledAmounts(Intent[] calldata intents) external view returns (uint256[] memory);

// In SecondaryMarket:
function executableAmounts(Intent[] calldata intents) public view returns (uint256[] memory) {
    uint256[] memory filled = IReactor(REACTOR).getFilledAmounts(intents);
    uint256[] memory available = new uint256[](intents.length);
    for (uint256 i = 0; i < intents.length; i++) {
        // compute using cached filled[i]
    }
    return available;
}
```

---

## [G-08] `cleanupExpiredIntentData` — Unbounded Loop Without Gas Savings

**Severity:** Medium | **Estimated Savings:** ~200 gas per iteration
**Location:** `contracts/market/TradeReactor.sol#L155-L162`

The loop variable `i` is not `unchecked`, and there's no early termination. Each iteration also hashes the intent (line 159) even if the intent is not expired.

```
L156: for (uint i = 0; i < intents.length; i++) {
L157:     Intent calldata intent = intents[i];
L158:     if (block.timestamp > intent.expiration) {
L159:         delete filledAmount[intent.hash()];
```

**Fix:**
```solidity
function cleanupExpiredIntentData(Intent[] calldata intents) external {
    for (uint256 i = 0; i < intents.length;) {
        Intent calldata intent = intents[i];
        if (block.timestamp > intent.expiration) {
            delete filledAmount[intent.hash()];
        }
        unchecked { ++i; }
    }
}
```

---

## [G-09] `SecondaryMarket.withdrawFees` — Double SLOAD for `owner`

**Severity:** Low | **Estimated Savings:** ~2,100 gas
**Location:** `contracts/market/SecondaryMarket.sol#L295-L300`

The `onlyOwner` modifier reads `owner()` from storage. Then line 297 calls `IERC20(currency).transfer(owner, ...)` which reads `owner` again (likely via the inherited `owner()` getter — another SLOAD).

```
L295: function withdrawFees(address currency, uint256 amount) public onlyOwner {
L297:     IERC20(currency).transfer(owner, amount - split);
```

**Fix:**
```solidity
function withdrawFees(address currency, uint256 amount) public onlyOwner {
    address _owner = owner(); // cache
    uint256 split = amount * licenseShare / 10000;
    IERC20(currency).transfer(_owner, amount - split);
    IERC20(currency).transfer(LICENSE_FEE_RECIPIENT, split);
    emit LicenseFeePaid(currency, LICENSE_FEE_RECIPIENT, split);
}
```

---

## [G-10] `ERC20Flaggable._approve` — Redundant Storage Write for Same Value

**Severity:** Low | **Estimated Savings:** ~100–5,000 gas (conditional)
**Location:** `contracts/ERC20/ERC20Flaggable.sol#L283-L286`

`_approve()` always writes to storage and emits an `Approval` event, even if the new value equals the current value. A SSTORE to a slot with the same value costs **100 gas** (warm) vs **5,000 gas** (cold write with value change).

```
L283: function _approve(address owner, address spender, uint256 value) internal {
L284:     _allowances[owner][spender] = value;
L285:     emit Approval(owner, spender, value);
```

**Fix:**
```solidity
function _approve(address owner, address spender, uint256 value) internal {
    if (_allowances[owner][spender] != value) {
        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
```

---

## [G-11] `Shares.burn()` — Transfer + Burn Instead of Direct Burn

**Severity:** Low | **Estimated Savings:** ~5,000–7,000 gas
**Location:** `contracts/shares/base/Shares.sol#L241-L244`

`burn()` first transfers tokens to the owner, then burns them. This triggers **two** `_beforeTokenTransfer` hooks (with full flag-checking logic) and **two** balance updates. A direct burn would skip the intermediate transfer.

```
L241: function burn(uint256 _amount) external {
L242:     _transfer(msg.sender, owner, _amount);
L243:     _burn(owner, _amount);
```

**Fix:**
```solidity
function burn(uint256 _amount) external {
    _burn(msg.sender, _amount);
}
```

This saves the gas of the intermediate transfer (balance read/write for sender and receiver, two `_beforeTokenTransfer` calls). Note: this changes the burn semantics — tokens are destroyed directly rather than returned to the owner first. If the legal requirement is to return shares to the issuer, keep the current pattern but consider if the double hook is truly needed.

---

## [G-12] `ERC20Allowlistable.setType(address[], uint8)` — External Call to Self

**Severity:** Low | **Estimated Savings:** ~2,600 gas per element
**Location:** `contracts/ERC20/ERC20Allowlistable.sol#L105-L109`

The batch `setType` calls the public `setType(address, uint8)` function in a loop, which adds external call overhead (JUMP + memory encoding) for each iteration.

```
L105: function setType(address[] calldata addressesToAdd, uint8 typeNumber) public onlyOwner {
L106:     for (uint i = 0; i < addressesToAdd.length; i++) {
L107:         setType(addressesToAdd[i], typeNumber);
```

**Fix:**
```solidity
function setType(address[] calldata addressesToAdd, uint8 typeNumber) public onlyOwner {
    for (uint256 i = 0; i < addressesToAdd.length;) {
        setTypeInternal(addressesToAdd[i], typeNumber);
        unchecked { ++i; }
    }
}
```

---

## [G-13] `IntentHash.hash()` — Dynamic `data` Field Always Hashed

**Severity:** Medium | **Estimated Savings:** ~100–1,000 gas per hash (if data is empty)
**Location:** `contracts/market/IntentHash.sol#L29-L45`

Every call to `intent.hash()` computes `keccak256(intent.data)` on line 42, even when `data` is empty (length 0). For the majority of intents in this codebase, `data` is `new bytes(0)` (see `SecondaryMarket.createBuyOrder/createSellOrder`). While `keccak256` of empty bytes is cheap (~30 gas), the `abi.encode` with a dynamic bytes field forces memory expansion and copy.

**Fix:** This is inherent to EIP-712 and cannot be avoided without breaking signature compatibility. However, if the protocol can migrate to a version without the `data` field (or with a fixed-size field), the hash computation becomes significantly cheaper.

Alternative: Pre-compute and cache the type hash prefix for empty data:
```solidity
bytes32 internal constant INTENT_TYPE_HASH_EMPTY = keccak256(abi.encode(
    INTENT_TYPE_HASH,
    bytes32(0), // owner placeholder for type hash
    // ... this doesn't work cleanly due to abi.encode padding
));
```

**Recommendation:** Accept this cost for now; the `data` field is necessary for protocol flexibility.

---

## [G-14] `ERC20Flaggable.balanceOf()` — Unnecessary Type Cast

**Severity:** Low | **Estimated Savings:** ~30 gas
**Location:** `contracts/ERC20/ERC20Flaggable.sol#L100-101`

`balanceOf()` casts the full `uint256` to `uint224` on every call. This is functionally correct (upper 32 bits are flags), but the cast adds a small computational cost.

```
L100: function balanceOf(address account) public view override returns (uint256) {
L101:     return uint224 (_balances [account]);
```

**Fix:**
```solidity
function balanceOf(address account) public view override returns (uint256) {
    return _balances[account] & ~FLAGGING_MASK;
}
```

This uses bitwise AND to mask out the flag bits, which is a single opcode vs the type conversion. The result is the same since the upper 32 bits are always zero in the returned value.

---

## [G-15] `Shares.batchMintAndWrap()` — Loop Overhead in `mintAndWrap()`

**Severity:** Low | **Estimated Savings:** ~1,000 gas per element
**Location:** `contracts/shares/base/Shares.sol#L219-L226`

`batchMintAndWrap()` calls `mintAndWrap()` which is a public function. Each call adds external-call-like overhead (JUMP, memory allocation for calldata). The inner function also reads `allowance(shareholder, wrapper)` via the public getter on line 205.

```
L219: function batchMintAndWrap(address[] calldata target, address wrapper, uint256[] calldata amount) external onlyOwner {
L223:     for (uint256 i = 0; i < len; i++) {
L224:         mintAndWrap(target[i], wrapper, amount[i]);
```

**Fix:** Inline the logic and use `unchecked` for the loop counter:
```solidity
function batchMintAndWrap(address[] calldata target, address wrapper, uint256[] calldata amount) external onlyOwner {
    if (target.length != amount.length) revert ArrayLengthMismatch();
    uint256 len = target.length;
    for (uint256 i = 0; i < len;) {
        address shareholder = target[i];
        uint256 amt = amount[i];
        _mint(shareholder, amt);
        uint256 currentAllowance = _allowances[shareholder][wrapper]; // direct storage read
        if (currentAllowance < INFINITE_ALLOWANCE) {
            _allowances[shareholder][wrapper] = currentAllowance + amt;
        }
        IWrapper(wrapper).mintFromBase(shareholder, amt);
        unchecked { ++i; }
    }
}
```

---

## Summary of Recommendations (Prioritized)

| Priority | Finding | Action | Est. Savings |
|----------|---------|--------|-------------|
| **P0** | G-01: Cache intent hashes in `process()` | Cache `sellerIntent.hash()` and `buyerIntent.hash()` in local variables | ~8,000–12,000 gas/trade |
| **P0** | G-03: Avoid re-hashing in event emission | Return hashes from reactor or pre-compute | ~4,000–6,000 gas/trade |
| **P0** | G-05: Reduce SafeERC20 overhead | Use lightweight transfer for known tokens in reactor | ~10,400 gas/trade |
| **P1** | G-02: Inline price match verification | Remove redundant `verifyPriceMatch` call | ~1,500–2,500 gas/trade |
| **P1** | G-04: Direct storage read for allowance | Replace public `allowance()` call with `_allowances[sender][msg.sender]` | ~2,100 gas/transferFrom |
| **P1** | G-07: Batch external calls in view functions | Add `getFilledAmounts()` batch view | ~10,000–15,000 gas/batch |
| **P2** | G-08: Unchecked loop increment | Add `unchecked { ++i; }` | ~200 gas/iteration |
| **P2** | G-06: Consider pause flag optimization | Evaluate dedicated bool slot | ~2,600 gas/transfer |
| **P2** | G-09: Cache owner address | Local variable for owner | ~2,100 gas/withdrawal |
| **P2** | G-10: Skip redundant approve | Check value before write | ~100–5,000 gas/approve |
| **P3** | G-11: Direct burn | Remove intermediate transfer | ~5,000–7,000 gas/burn |
| **P3** | G-12: Inline batch setType | Call `setTypeInternal` directly | ~2,600 gas/element |
| **P3** | G-14: Bitwise mask for balanceOf | Replace uint224 cast with AND | ~30 gas/balanceOf |
| **P3** | G-15: Inline batchMintAndWrap | Direct storage + unchecked | ~1,000 gas/element |

---

## Impact Analysis

For a typical trade (buy/sell 100 tokens), applying **P0 + P1** findings together:

- **Current gas overhead:** ~25,000–30,000 gas from redundant hashing + SafeERC20 wrapping + double reads
- **Optimized gas overhead:** ~5,000–8,000 gas
- **Savings per trade:** ~17,000–22,000 gas (~$2–4 at 30 gwei on L1, or ~$0.02–0.04 on L2)

For a token with 10,000 transfers/year, the P0 findings alone save **~80,000,000 gas/year** (~$1,500 at 30 gwei L1).
