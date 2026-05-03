# CMTAT Equivalency Assessment Criteria

## How to Use This Document
- Use the **CMTAT Function Equivalency Table** as the fillable assessment checklist.
- Use **Guideline for New Blockchain Implementations** as reference guidance when designing or mapping non-Solidity implementations.

## General Note
- The listed functionalities are the **minimal set** required for each module.

## CMTAT Function Equivalency Table

### Metadata
- Implementation language: Solidity (`>=0.8.0 <0.9.0`)
- Version: `CMTACompatibleSecurity` v6 (`VERSION = 6`)

### Mandatory Attributes
| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.a | Name attribute | ERC20 `name` |  | y | `string public name` in `ERC20Named`, set in constructor, mutable via `setName(symbol, name)` (onlyOwner). |
| 1.b | Ticker symbol attribute | ERC20 `symbol` |  | y | `string public symbol` in `ERC20Named`, set in constructor, mutable via `setName(symbol, name)` (onlyOwner). |
| 1.c | Token ID attribute | `tokenId` |  | n | Not implemented. The contract exposes no on-chain `tokenId`; identity is by contract address only. `VERSION` is a contract-level revision marker, not a token identifier. |
| 1.d | Reference to legally required documentation | `terms` |  | y | `string public terms` set in constructor, updatable via `setTerms` (onlyOwner). Linked URL fulfills the article 973d para 2 clause 3 requirement. `ChangeTerms` event on update. |
| 1.e | No fractions | ERC20 `decimals` | Decimals must be set to zero unless governing law permits fractions. | y | `decimals` is hardcoded to `0` in the constructor (`ERC20Named(_symbol, _name, 0, _owner)`). |

### Mandatory Functions
| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.1 | Know total supply | ERC20 `totalSupply` |  | y | `totalSupply()` from `ERC20Flaggable`. |
| 1.2 | Know balance | ERC20 `balanceOf` |  | y | `balanceOf(address)` from `ERC20Flaggable`. The lower 224 bits of the balance slot hold the balance (upper 32 bits are reserved for per-account flags); the getter masks these out. |
| 1.3 | Transfer tokens | ERC20 `transfer` |  | y | `transfer(recipient, amount)` and `transferFrom(sender, recipient, amount)` from `ERC20Flaggable`. Also exposes ERC-677 `transferAndCall(recipient, amount, data)`. Allowance values `>= 2**255` are treated as infinite (never decremented on `transferFrom`). |
| 1.4 | Create tokens | `mint` / `batchMint` |  | y | `mint(target, amount)` and `batchMint(target[], amount[])`, both `onlyOwner`. Plus `mintAndWrap(shareholder, wrapper, amount)` and `batchMintAndWrap` for combined mint + wrap into a `SharesUnderAgreement`-style wrapper in one transaction. |
| 1.5 | Cancel tokens | `burn` / `batchBurn` / `burnFrom` | Use a dedicated issuer/authorized burn path for forced cancellation scenarios. | partial | User-initiated `burn(uint256)` transfers tokens to the owner and burns them from there. Issuer-side forced cancellation is via `Recoverable.burn(lostAddress)` / `Recoverable.burn(lostAddress, balance)`, gated by a 184-day burn-recovery proposal initiated through `initBurn(target)`. No `batchBurn` and no `burnFrom`. Burns are blocked while paused (the pause check fires before the cancellation/burn allowance in `_beforeTokenTransfer`). |
| 1.6 | Pause tokens | `pause` | Pause must prevent all transfers until `unpause` is called. | y | `pause()` (onlyOwner) sets a global flag (`GLOBAL_FLAG_INDEX_PAUSED = 100`) on `ERC20Flaggable._settings`. `_beforeTokenTransfer` reverts every transfer (including mints, burns, recoveries, and migrations) with `TransfersPaused` while the flag is set. Emits `Paused`. |
| 1.7 | Unpause tokens | `unpause` |  | y | `unpause()` (onlyOwner) clears the global pause flag and emits `Unpaused`. Reversible. |
| 1.8 | Deactivate contract | `deactivateContract` | Must permanently disable the token (except in upgradeability patterns where deactivation behavior is explicitly defined). | y | `deactivateContract()` (onlyOwner) sets a one-way global flag (`GLOBAL_FLAG_INDEX_CANCELLED = 101`); there is no setter to clear it. While cancelled, `_beforeTokenTransfer` only permits transfers where `to == address(0)` (burn) or `to == address(successor)` (migration); all other transfers — including mints, regular `Recoverable.recover`, and ordinary `transfer` — revert with `Cancelled`. Emits `Deactivated`. |
| 1.9 | Freeze | `freeze` or `setAddressFrozen(true)` *(inferred from extracted PDF text)* | Must block transfers to and from a given address. Single-function implementations are acceptable if they set a frozen status. | y | Realized via `ERC20Allowlistable.setType(account, TYPE_RESTRICTED)` (onlyOwner, also accepts an address array). A `RESTRICTED` address cannot receive any tokens and can only send to an `ADMIN` address. Stored as a per-account flag in the upper 32 bits of the balance slot. |
| 1.10 | Unfreeze | `unfreeze` or `setAddressFrozen(false)` *(inferred from extracted PDF text)* | Single-function implementations are acceptable if they clear a frozen status. | y | `setType(account, TYPE_FREE)` (or `TYPE_ALLOWED`) clears the restricted flag. |

### Optional Functions

#### Snapshot
| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.11 | Schedule a snapshot | `scheduleSnapshot(uint256 time)` | SnapshotEngine `ISnapshotScheduler`. | n | No snapshot module. |
| 1.12 | Reschedule a snapshot | `rescheduleSnapshot(uint256 oldTime, uint256 newTime)` | `newTime` must stay between adjacent scheduled snapshots (not before previous / not after next). | n | No snapshot module. |
| 1.13 | Unschedule a snapshot | `unscheduleLastSnapshot(uint256 time)` / `unscheduleSnapshotNotOptimized(uint256 time)` | `unscheduleLastSnapshot` is restricted to the latest scheduled snapshot; `unscheduleSnapshotNotOptimized` supports generic unscheduling. | n | No snapshot module. |
| 1.14 | Snapshot time | `getAllSnapshots()` / `getNextSnapshots()` | Returns created snapshot times and pending scheduled times. | n | No snapshot module. |
| 1.15 | Snapshot total supply | `snapshotTotalSupply(uint256 time)` | `ISnapshotState`. | n | No snapshot module. |
| 1.16 | Snapshot balance | `snapshotBalanceOf(uint256 time, address tokenHolder)` | `ISnapshotState` (see also `snapshotInfo`). | n | No snapshot module. |

#### Access Control
| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.17 *(Mandatory for debt)* | Conditional transfer request | `RuleConditionalTransferLight.detectTransferRestriction(from, to, value)` / `detectTransferRestrictionFrom(spender, from, to, value)` and `approvedCount(from, to, value)` | Request is represented by a transfer restricted until approval count is non-zero. | n | No conditional transfer module; the contract is not intended for debt securities. |
| 1.18 *(Mandatory for debt)* | Conditional transfer approval | `RuleConditionalTransferLight.approveTransfer(from, to, value)` (or `approveAndTransferIfAllowed`) | Approval is consumed on transfer via `transferred(...)`; cancellation via `cancelTransferApproval(...)`. | n | No conditional transfer module. |
| 1.19 | Assign to whitelist | CMTAT Allowlist: `setAddressAllowlist(account, status)`, `batchSetAddressAllowlist(accounts, status)`, `isAllowlisted(account)`; Rules whitelist: `addAddress`, `removeAddress`, `addAddresses`, `removeAddresses`, `isAddressListed` | CMTAT Allowlist and Rules whitelist are alternative whitelist implementations. | y | `ERC20Allowlistable.setType(account, TYPE_ALLOWED)` and the array overload `setType(addresses[], TYPE_ALLOWED)` (both onlyOwner). Membership is queried via `isAllowed(account)`, with `isAdmin` and `isRestricted` covering the other states. Whether the allowlist is enforced for newly minted tokens is gated by `setApplicable(bool)` (onlyOwner), which sets address `0x0` to `ADMIN` (applicable) or `FREE` (inactive). When applicable, transfers from an `ADMIN` source automatically allowlist the recipient. |
| 1.20 | Grant role | `grantRole(bytes32 role, address account)` (OpenZeppelin AccessControl via CMTAT/Rules modules) | Used for roles such as `ALLOWLIST_ROLE`, `DEBT_ROLE`, `OPERATOR_ROLE`, `COMPLIANCE_MANAGER_ROLE`. | n | No granular RBAC. The contract uses a single-owner model (`Ownable.transferOwnership`); all administrative entry points are gated by `onlyOwner`. |
| 1.21 | Revoke role | `revokeRole(bytes32 role, address account)` | AccessControl role removal. | n | No RBAC; ownership is single-step transferable. |
| 1.22 | Role attribution | `hasRole(bytes32 role, address account)` / `getRoleAdmin(bytes32 role)` | In CMTAT `AccessControlModule`, `DEFAULT_ADMIN_ROLE` is treated as having all roles in `hasRole`. | n | No RBAC; only `owner == msg.sender` is checked. |

#### Dividend

| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.23 | Distribution create parameters |  |  | n | No on-chain dividend / distribution module. Distributions are handled out-of-band by the issuer. |
| 1.24 | Distribution set eligibility |  |  | n | No dividend module. |
| 1.25 | Distribution set deposit |  |  | n | No dividend module. |
| 1.26 | Distribution claim deposit |  |  | n | No dividend module. |
| 1.27 | Distribution schedule |  |  | n | No dividend module. |
| 1.28 | Distribution unschedule |  |  | n | No dividend module. |

#### Credit Events
| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.29 | Flag as default | `setCreditEvents(CreditEvents)` -> `creditEvents().flagDefault` | Managed in `ICMTATCreditEvents.CreditEvents`. | n | No credit events module; the contract is intended for equity, not debt. |
| 1.30 | Remove default flag | `setCreditEvents(CreditEvents)` with `flagDefault = false` | Same function as 1.29 with different value. | n | No credit events module. |
| 1.31 | Flag as redeemed | `setCreditEvents(CreditEvents)` -> `creditEvents().flagRedeemed` | Managed in `ICMTATCreditEvents.CreditEvents`. | n | No credit events module. |
| 1.32 | Set rating | `setCreditEvents(CreditEvents)` -> `creditEvents().rating` | Managed in `ICMTATCreditEvents.CreditEvents`. | n | No credit events module. |

#### Enforcement
| ID | Requirement | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.33 | Enforce a transfer | `forcedTransfer(address from, address to, uint256 value)` | Enforcement transfer is performed via `forcedTransfer`. | partial | No immediate `forcedTransfer`. The closest analog is the Swiss CO 973d-aligned recovery in `Recoverable`: any caller may `initRecovery(lostAddress, recipient)` (paying a deterrence fee), and after a 184-day delay anyone may call `recover(lostAddress)` to transfer the lost address's full current balance to the recorded recipient. The owner can also `cancelRecovery(lostAddress)` and the lost address itself can self-cancel. There is no zero-delay enforcement path. |
| 1.34 | Partial freeze | `freezePartialTokens(address account, uint256 value)` / `unfreezePartialTokens(address account, uint256 value)` | Intended only to block a sold amount to avoid double-spend during settlement. | n | The allowlist freezes whole addresses (`TYPE_RESTRICTED`); there is no per-amount partial freeze. |

### Optional Attributes
| ID | Attribute | CMTAT Solidity corresponding feature | Notes | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|
| 1.f | Guarantor identifier | `debt().debtIdentifier.guarantor` (set via `setDebt`) | Debt module (`ICMTATDebt.DebtIdentifier`). | n | No debt module; equity instrument. |
| 1.g | Debtholder representative identifier | `debt().debtIdentifier.debtHolder` (set via `setDebt`) | Debt module (`ICMTATDebt.DebtIdentifier`). | n | No debt module. |
| 1.h | Unique identifier / hash | `tokenId()` and `terms().doc.documentHash` | `tokenId` is base identifier; hash is in terms document metadata. | n | The `terms` field stores a URL only; no on-chain document hash and no `tokenId`. |
| 1.i | Issuance date | `debt().debtInstrument.issuanceDate` (set via `setDebt` / `setDebtInstrument`) | Debt module (`ICMTATDebt.DebtInstrument`). | n | No debt module. |
| 1.j | Currency of payments | `debt().debtInstrument.currency` / `debt().debtInstrument.currencyContract` | Supports symbol-like string and token/asset contract address. | n | No debt module. |
| 1.k | Par value | `debt().debtInstrument.parValue` | Debt module (`uint256`). | n | No debt module. |
| 1.l | Minimum denomination | `debt().debtInstrument.minimumDenomination` | Debt module (`uint256`). | n | No debt module. |
| 1.m | Maturity date | `debt().debtInstrument.maturityDate` | Debt module (`string`). | n | No debt module. |
| 1.n | Interest rate | `debt().debtInstrument.interestRate` | Debt module (`uint256`). | n | No debt module. |
| 1.o | Coupon payment frequency | `debt().debtInstrument.couponPaymentFrequency` | Debt module (`string`). | n | No debt module. |
| 1.p | Interest schedule format: A) start date/end date/period; B) start date/end date/day of period; C) date 1/date 2/date 3 | `debt().debtInstrument.interestScheduleFormat` | Debt module (`string`). | n | No debt module. |
| 1.q | Interest payment date: A) period; B) specific date | `debt().debtInstrument.interestPaymentDate` | Debt module (`string`). | n | No debt module. |
| 1.r | Day count convention | `debt().debtInstrument.dayCountConvention` | Debt module (`string`). | n | No debt module. |
| 1.s | Business day convention | `debt().debtInstrument.businessDayConvention` | Debt module (`string`). | n | No debt module. |

## Guideline for New Blockchain Implementations

If you create a version for another blockchain, use this section to build a correspondence table between the CMTAT framework, the CMTAT Solidity version, and your implementation.

### Freeze

To be compatible with [ERC-3643](https://eips.ethereum.org/EIPS/eip-3643), freeze is implemented with a single function: `setAddressFrozen(targetAddress, frozenStatus)`.

For non-EVM blockchains, it can be clearer to separate this into two distinct functions:

```solidity
freeze(address targetAddress)
unfreeze(address targetAddress)
```

### CMTAT Extended

In the table below, the CMTAT framework extended features are mapped to Solidity features.

| CMTAT Functionalities | CMTAT Solidity corresponding features | CMTAT Allowlist | CMTAT Light | CMTAT Debt | CMTAT Standard |
|---|---|---|---|---|---|
| On-chain snapshot | `snapshotModule` and `snapshotEngine` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |
| Forced transfer | `forcedTransfer` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |
| Forced burn | `forcedBurn` | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> |
| Freeze partial token | `freezePartialTokens` / `unfreezePartialTokens` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |
| Integrated whitelisting/allowlisting | CMTAT Allowlist | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> |
| External whitelisting/allowlisting | CMTAT with rule whitelist | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |
| RuleEngine / transfer hook | CMTAT with RuleEngine | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |
| Upgradeability | CMTAT Upgradeable version | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |
| Fee payer / gasless | CMTAT with ERC-2771 module | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |

### Forced Burn and Forced Transfer

In the standard burn function, it is not possible to burn tokens from a frozen wallet. CMTAT offers `forcedTransfer` to force a transfer or a burn.

If `forcedTransfer` is not available, an alternative is to implement only `forcedBurn` (as in CMTAT Light). You can also implement both. In that case, it is suggested that only `forcedBurn` burns tokens, and `forcedTransfer` does not.

With the CMTAT Solidity version, when `forcedTransfer` is available, `forcedBurn` is not implemented to reduce contract code size. This limitation may not apply to other blockchains.

### Implementation Details

| Functionalities | CMTAT Solidity | Note |
|---|---|---|
| Mint while pause | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | Dedicated cross-chain mint (for example `crosschainMint`) cannot be performed while paused. |
| Burn while pause | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | Dedicated cross-chain burn (for example `crosschainBurn`) cannot be performed while paused. |
| Self-Burn for everyone | <strong><span style="color: #b00020;">&#x2718;</span></strong> | Token holders cannot burn their own tokens; only authorized addresses can burn. |
| Self-Burn for authorized addresses | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> |  |
| Standard burn on a frozen address | <strong><span style="color: #b00020;">&#x2718;</span></strong> | Requires `forcedTransfer` or `forcedBurn`. |
| Burn tokens with `forcedTransfer` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | See notes above. |

### Self-Burn

Only the issuer and authorized addresses (not the token holder) can burn a token in CMTAT Solidity, which reflects legal requirements in several jurisdictions.

Once issued, a security can only be cancelled by its issuer, not its holder. Since the token represents the security, the same rule applies. An investor who wants to exit should transfer to the issuer, who can then cancel when legally permitted.

You can still add self-burn in your version if it fits your legal or business context.

## Reference

Submodules used in this project and current checked-out versions:

| Submodule | Repository | Version | Commit |
|---|---|---|---|
| CMTAT | https://github.com/CMTA/CMTAT | `v3.2.0` | `49544f4de1993008acfc9e848d0bf03bd31d8579` |
| SnapshotEngine | https://github.com/CMTA/SnapshotEngine | `v0.3.0-1-g19e0b56` | `19e0b569bf5823aa8cec5760f080a932a9ac940e` |
| RuleEngine | https://github.com/CMTA/RuleEngine | `v3.0.0-rc2-2-g9c0aa70` | `9c0aa70aae08047e4062beab0f89f92bd60252c0` |
| Rules | https://github.com/CMTA/Rules | `v0.3.0` | `91c21c1191e84ff938892267ec443b0d1bb9efb0` |
