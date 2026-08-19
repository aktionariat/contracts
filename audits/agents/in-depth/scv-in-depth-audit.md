# SCV Scan — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Systematic vulnerability sweep using cheatsheet patterns on in-scope contracts

## Findings

### [F-1] DeterrenceFee: ETH sent to owner via low-level call — return value unchecked

**Severity:** MEDIUM
**Location:** `contracts/utils/DeterrenceFee.sol:60`

```solidity
(bool success, ) = payable(owner).call{value: msg.value}("");
```

The `success` variable is captured but never checked. If the ETH transfer fails (e.g., owner is a contract that reverts on receive), the function continues execution without reverting. This means the caller paid the deterrence fee (via `msg.value`) but the fee was not actually delivered to the owner. The function proceeds to execute the guarded action.

**Recommendation:** Add `require(success, "ETH transfer failed")` after the call.

---

### [F-2] MultichainWallet: refund uses unchecked low-level call — return value ignored

**Severity:** LOW
**Location:** `contracts/multisig/MultichainWallet.sol:133`

```solidity
payable(msg.sender).call{value: amount}("");
```

Return value of the refund call is not checked. If the refund fails, ETH is stuck in the contract permanently.

---

### [F-3] MultichainWallet: ERC20 transferFrom return value not checked

**Severity:** LOW
**Location:** `contracts/multisig/MultichainWallet.sol:116`

```solidity
IERC20(message.feeToken).transferFrom(msg.sender, address(this), fee);
```

Raw `transferFrom` call without `SafeERC20`. For tokens that return `false` on failure, this silently fails.

---

### [F-4] Shares: burn function allows any holder to burn their own tokens

**Severity:** INFORMATIONAL
**Location:** `contracts/shares/base/Shares.sol:241-244`

```solidity
function burn(uint256 _amount) external {
    _transfer(msg.sender, owner, _amount);
    _burn(owner, _amount);
}
```

Any token holder can burn their tokens by transferring them to the owner and then burning from the owner. This is documented behavior (see NatSpec) but worth noting that it does not require owner approval.

---

### [F-5] ERC20Flaggable: transferAndCall reentrancy via ERC-677 callback

**Severity:** LOW
**Location:** `contracts/ERC20/ERC20Flaggable.sol:282-284`

```solidity
function transferAndCall(address recipient, uint amount, bytes calldata data) external virtual returns (bool) {
    return transfer(recipient, amount) && IERC677Receiver(recipient).onTokenTransfer(msg.sender, amount, data);
}
```

The `transfer` is executed before `onTokenTransfer`. If `recipient` is a malicious contract, it could re-enter during the callback. However, the transfer has already completed (CEI is respected for the transfer itself), so re-entry would not yield additional funds from this function.

**Status:** Informational — CEI is correctly followed for the transfer.
