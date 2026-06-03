# CMTAT Equivalency Assessment Criteria

## Table of Contents

- [Document Version](#document-version)
- [How to Use This Document](#how-to-use-this-document)
- [General Note](#general-note)
- [Warning](#warning)
- [CMTAT Function Equivalency Table](#cmtat-function-equivalency-table)
  - [Metadata](#metadata)
  - [Token Attributes](#token-attributes)
    - [Token module](#token-module)
  - [Pause module (mandatory)](#pause-module-mandatory)
    - [Enforcement](#enforcement)
    - [Transfer restriction (optional)](#transfer-restriction-optional)
    - [Access Control](#access-control)
    - [Snapshot (optional)](#snapshot-optional)
    - [Dividend (optional)](#dividend-optional)
    - [Credit Events (optional)](#credit-events-optional)
  - [Debt (optional)](#debt-optional)
- [Guideline for New Blockchain Implementations](#guideline-for-new-blockchain-implementations)
  - [Freeze](#freeze)
  - [CMTAT Extended](#cmtat-extended)
  - [Forced Burn and Forced Transfer](#forced-burn-and-forced-transfer)
  - [Implementation Details](#implementation-details)
  - [Self-Burn](#self-burn)
- [Supplementary features](#supplementary-features)
- [Reference](#reference)

## Document Version
`v0.2.0`

Note: 

- versions with the `rc` suffix are draft versions.
- version before `1.0` are also draft versions

## How to Use This Document
- Use the **CMTAT Function Equivalency Table** as the fillable assessment checklist.
- Use **Guideline for New Blockchain Implementations** as reference guidance when designing or mapping non-Solidity implementations.

## General Note
- The listed functionalities are the **minimal set** required for each module.
- The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/info/rfc2119) and [RFC 8174](https://www.rfc-editor.org/info/rfc8174).

## Warning
An implementation MAY satisfy the CMTAT standard while still failing to meet the criteria required for tokenized shares under Swiss law at the underlying-ledger level. In particular, compliance with CMTAT does not, by itself, demonstrate that decentralization-related legal criteria are satisfied.

## CMTAT Function Equivalency Table

### Metadata
- Implementation language: Solidity (`>=0.8.0 <0.9.0`)
- Implementation version: `Shares` v6 (`VERSION = 6`) is the primary subject of this assessment. Where the shareholder-agreement variant `SharesUnderAgreement` v5 (`VERSION = 5`) differs, this is noted inline. Both share the same base contracts (`ERC20Flaggable`, `ERC20Named`, `ERC20Allowlistable`, `Recoverable`, `Ownable`, `DeterrenceFee`).

### Token Attributes
#### Mandatory
| ID | Requirement | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 1 | Name attribute | ERC20 `name` | Public (`view`) |  | y | Read: public (`view`); write: `setName(symbol, name)` (onlyOwner) | `string public name` in `ERC20Named`, set in constructor, mutable via `setName(symbol, name)` (onlyOwner). |
| 2 | Ticker symbol attribute | ERC20 `symbol` | Public (`view`) |  | y | Read: public (`view`); write: `setName(symbol, name)` (onlyOwner) | `string public symbol` in `ERC20Named`, set in constructor, mutable via `setName(symbol, name)` (onlyOwner). |
| 3 | Reference to legally required documentation | `terms` | Public (`view`) |  | y | Read: public (`view`); write: `setTerms` (onlyOwner) | `string public terms` set in constructor, updatable via `setTerms` (onlyOwner), `ChangeTerms` event on update. The linked URL fulfills the article 973d para 2 clause 3 requirement. Present in both `Shares` and `SharesUnderAgreement` (in the latter the URL points to the shareholder agreement). |
| 4 | No fractions | ERC20 `decimals` | Public (`view`) | - Decimals must be set to zero unless governing law permits fractions.<br />- CMTAT Solidity allows configurable decimals at deployment | y | Public (`view`), set at deployment | In `Shares`, `decimals` is hardcoded to `0` in the constructor (`ERC20Named(_symbol, _name, 0, _owner)`), satisfying the no-fractions requirement for Swiss shares. `SharesUnderAgreement` accepts `_decimals` as a constructor parameter so the wrapper can match the granularity of the wrapped base token. |

For CMTAT reference implementations, decimals SHOULD be configurable rather than defaulting to zero, to support use cases beyond tokenized shares in Switzerland.

##### Note

> This subsection can be used to detail how mandatory token attributes are implemented and to document specific legal, business, or chain-specific cases.

#### Optional
| ID | Requirement | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 5 | Token ID attribute | `tokenId` | Public (`view`) | Optional parameter. | n |  |  |

For CMTAT reference implementations, `tokenId` SHOULD be included.

##### Note

> This subsection can be used to detail optional token attributes implemented by the target system and to explain specific cases where an optional field is omitted or represented differently.



#### Token module

##### Mandatory

| ID | Requirement | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 6 | Know total supply | ERC20 `totalSupply` | Public (`view`) |  | y | Public (`view`) | `totalSupply()` from `ERC20Flaggable`. |
| 7 | Know balance | ERC20 `balanceOf` | Public (`view`) |  | y | Public (`view`) | `balanceOf(address)` from `ERC20Flaggable`. The lower 224 bits of the balance slot hold the balance (upper 32 bits are reserved for per-account flags); the getter masks these out. |
| 8 | Transfer tokens | ERC20 `transfer` | Token holder (`msg.sender`) |  | y | Token holder (`msg.sender`); `transferFrom` requires allowance | `transfer(recipient, amount)` and `transferFrom(sender, recipient, amount)` from `ERC20Flaggable`. Also exposes ERC-677 `transferAndCall(recipient, amount, data)`. Allowance values `>= 2**255` are treated as infinite (never decremented on `transferFrom`). |
| 9 | Create tokens | `mint` / `batchMint` | Role-restricted (issuer/minter authorized) |  | y | onlyOwner (issuer) | `Shares`: `mint(target, amount)` and `batchMint(target[], amount[])`, both onlyOwner, plus `mintAndWrap` / `batchMintAndWrap` for combined mint + wrap into a `SharesUnderAgreement` wrapper in one transaction. `SharesUnderAgreement` does not mint out of nothing: new wrapped tokens are created by `wrap` / `mintFromBase`, which escrow base tokens 1:1 (the latter callable only by the base token, used by `mintAndWrap`). |
| 10 | Cancel tokens | `burn` / `batchBurn` / `burnFrom` | Role-restricted (issuer/burner authorized) | Implementations SHOULD use a dedicated issuer/authorized burn path for forced cancellation scenarios. | y (see notes) | Issuer burn: onlyOwner (time-locked); holder self-burn: token holder | Issuer-driven burns use `Recoverable.burn(lostAddress)` / `Recoverable.burn(lostAddress, balance)` (onlyOwner), subject to a 184-day time-lock that gives the rightful owner the opportunity to refuse the burning of their tokens (analogous to Swiss CO art. 983). A holder can also self-initiate `Shares.burn(uint256)`, which transfers the tokens to the owner and burns them from there. There is no `batchBurn`; bulk reissuance uses the explicit migration process (successor token in `Shares`, `Modification` cancellation in `SharesUnderAgreement`, which burns the escrowed base via `proposeCancellation` / `executeMigration`). |
#### Optional

| ID   | Requirement | CMTAT Solidity corresponding feature            | Access Control (CMTAT Solidity) | Notes                                                        | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 11   | Approve     | ERC20 `approve(address spender, uint256 value)` | Token holder                    | Grants a delegate permission to transfer a specific amount of tokens from the token account. This is optional, but implementations SHOULD include it since secondary market capability may depend on delegated approval to automate trading and settlement for regulated entities. Issuers SHOULD consult relevant trading and settlement venues if listing is contemplated. | y | Token holder | `approve(spender, value)` and `allowance(owner, spender)` from `ERC20Flaggable`. Allowance values `>= 2**255` (`INFINITE_ALLOWANCE`) are treated as infinite and never decremented on `transferFrom` (see `doc/infiniteallowance.md`). `mintAndWrap` uses the internal `_approve` to grant the wrapper the allowance it needs. There is no on-chain `permit` (EIP-2612) in v5/v6. |

##### Note

> This subsection can be used to detail how each mandatory function is implemented, including role model, execution flow, and specific chain-level behavior.

### Pause module (mandatory)

| ID   | Requirement         | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity)           | Notes                                                        | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 12   | Pause tokens        | `pause`                              | Role-restricted (pauser/admin authorized) | Pause must prevent all transfers until `unpause` is called.  | y | onlyOwner | `pause()` (in `ERC20Allowlistable`, inherited by both contracts) sets a global flag (`GLOBAL_FLAG_INDEX_PAUSED = 100`). `_beforeTokenTransfer` reverts every transfer — including mints, burns, recoveries, and migrations — with `TransfersPaused` while the flag is set. Emits `Paused`. |
| 13   | Unpause tokens      | `unpause`                            | Role-restricted (pauser/admin authorized) |                                                              | y | onlyOwner | `unpause()` (onlyOwner) clears the global pause flag and emits `Unpaused`. Reversible. |
| 14   | Deactivate contract | `deactivateContract`                 | Role-restricted (admin authorized)        | Must permanently disable the token (except in upgradeability patterns where deactivation behavior is explicitly defined). | n | — | No permanent deactivation function. Upgrade/retirement is handled through explicit, time-locked migration: a successor token in `Shares` (`setSuccessor` / `migrate`) and the `Modification` module in `SharesUnderAgreement` (`proposeMigration` / `proposeTermination` / `proposeCancellation` / `executeMigration`). |

#### Enforcement

#### Mandatory

| ID   | Requirement | CMTAT Solidity corresponding feature                         | Access Control (CMTAT Solidity)               | Notes                                                        | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 15   | Freeze      | `freeze` or `setAddressFrozen(true)` *(inferred from extracted PDF text)* | Role-restricted (compliance/admin authorized) | Must block transfers to and from a given address. Single-function implementations are acceptable if they set a frozen status. | y | onlyOwner | Realized via `ERC20Allowlistable.setType(account, TYPE_RESTRICTED)` (onlyOwner; also accepts an address array). A `RESTRICTED` address cannot receive any tokens and can only send to an `ADMIN` address. Stored as a per-account flag in the upper 32 bits of the balance slot. |
| 16   | Unfreeze    | `unfreeze` or `setAddressFrozen(false)` *(inferred from extracted PDF text)* | Role-restricted (compliance/admin authorized) | Single-function implementations are acceptable if they clear a frozen status. | y | onlyOwner | `setType(account, TYPE_FREE)` (or `TYPE_ALLOWED`) clears the restricted flag. |



#### Optional

| ID   | Requirement        | CMTAT Solidity corresponding feature                         | Access Control (CMTAT Solidity)                  | Notes                                                        | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 17   | Enforce a transfer | `forcedTransfer(address from, address to, uint256 value)`    | Role-restricted (operator/compliance authorized) | Enforcement transfer is performed via `forcedTransfer`.      | partial | Time-locked, not issuer-discretionary | `Shares` has no arbitrary issuer-discretionary forced transfer. Two time-locked, governance-bounded mechanisms come close: (1) `Recoverable.recover(lostAddress)` moves a lost address's full balance to a new recipient after a 184-day delay during which the holder can veto via `cancelRecovery`; (2) in `SharesUnderAgreement`, the `DragAlong` module force-sells minority holders' wrapped shares to a buyer after a 20-day veto window (`offerAcquisition` / `acceptOffer`), with sellers paid in the offered currency. These reflect the registration / shareholder agreement rather than a unilateral compliance override. |
| 18   | Partial freeze     | `freezePartialTokens(address account, uint256 value)` / `unfreezePartialTokens(address account, uint256 value)` | Role-restricted (operator/compliance authorized) | Intended only to block a sold amount to avoid double-spend during settlement. | n | — | The allowlist freezes whole addresses (`TYPE_RESTRICTED`); there is no per-amount partial freeze. |



#### Transfer restriction (optional)

| ID   | Requirement                   | CMTAT Solidity corresponding feature                         | Access Control (CMTAT Solidity)                         | Notes                                                        | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 19   | Conditional transfer request  | `RuleConditionalTransferLight.detectTransferRestriction(from, to, value)` / `detectTransferRestrictionFrom(spender, from, to, value)` and `approvedCount(from, to, value)` | Public (`view`)                                         | Request is represented by a transfer restricted until approval count is non-zero. | n | — | No conditional transfer module; the contract is not intended for debt securities. |
| 20   | Conditional transfer approval | `RuleConditionalTransferLight.approveTransfer(from, to, value)` (or `approveAndTransferIfAllowed`) | Role-restricted (compliance/approver authorized)        | Approval is consumed on transfer via `transferred(...)`; cancellation via `cancelTransferApproval(...)`. | n | — | No conditional transfer module. |
| 21   | Assign to whitelist           | CMTAT Allowlist: `setAddressAllowlist(account, status)`, `batchSetAddressAllowlist(accounts, status)`, `isAllowlisted(account)`; Rules whitelist: `addAddress`, `removeAddress`, `addAddresses`, `removeAddresses`, `isAddressListed` | Role-restricted for setters; public (`view`) for checks | CMTAT Allowlist and Rules whitelist are alternative whitelist implementations. | y | Setters: onlyOwner; checks: public (`view`) | `ERC20Allowlistable.setType(account, TYPE_ALLOWED)` and the array overload `setType(addresses[], TYPE_ALLOWED)` (both onlyOwner). Membership is queried via `isAllowed(account)`, with `isAdmin` and `isRestricted` covering the other states. |

##### Note

> This subsection can be used to detail the different transfer restrictions available.



#### Access Control

| ID   | Requirement      | CMTAT Solidity corresponding feature                         | Access Control (CMTAT Solidity)                 | Notes                                                        | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 22   | Grant role       | `grantRole(bytes32 role, address account)` (OpenZeppelin AccessControl via CMTAT/Rules modules) | Role admin (`DEFAULT_ADMIN_ROLE` or role admin) | Used for roles such as `ALLOWLIST_ROLE`, `DEBT_ROLE`, `OPERATOR_ROLE`, `COMPLIANCE_MANAGER_ROLE`. | n | — | No granular RBAC. The contract uses a single-owner model (`Ownable`); all administrative entry points are gated by `onlyOwner`. The privileged address is reassigned via `transferOwnership(newOwner)` (onlyOwner). |
| 23   | Revoke role      | `revokeRole(bytes32 role, address account)`                  | Role admin (`DEFAULT_ADMIN_ROLE` or role admin) | AccessControl role removal.                                  | n | — | No RBAC; ownership is single-step transferable via `transferOwnership`. |
| 24   | Role attribution | `hasRole(bytes32 role, address account)` / `getRoleAdmin(bytes32 role)` | Public (`view`)                                 | In CMTAT `AccessControlModule`, `DEFAULT_ADMIN_ROLE` is treated as having all roles in `hasRole`. | n | Public (`view`) `owner` getter | No RBAC; only `msg.sender == owner` is checked. The public `owner` getter exposes the single privileged address. |

##### Note

> This subsection can be used to detail the concrete authorization model (roles, admins, delegates, approvers) and implementation-specific exceptions. It MAY also be relevant to explain how access control works in the implementation being approved.

The implementation uses a single-owner authorization model (`Ownable`) instead of OpenZeppelin `AccessControl` role-based access. There is exactly one privileged principal, `owner`, exposed via the public `owner` getter and reassigned with `transferOwnership(newOwner)` (a single-step transfer, `onlyOwner`). All administrative entry points — `mint`/`batchMint`/`mintAndWrap`, `setType`/`setApplicable`, `pause`/`unpause`, `setTerms`/`setTokenId`/`setName`, `setSuccessor`, `announcement`, the issuer `burn`/recovery functions, and (in `SharesUnderAgreement`) `setTerms` — are gated by `onlyOwner`. Some governance actions are intentionally *not* owner-exclusive: in `SharesUnderAgreement`, any holder controlling more than 10% of the supply (or the buyer) can propose/cancel a drag-along or migration, and recoveries can be vetoed by the affected address itself. The `owner` is expected to be a contract operated under the registration agreement (typically an Aktionariat-managed multisig/recovery contract), not necessarily an EOA.

#### Snapshot (optional)
| ID | Requirement | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 25 | Schedule a snapshot | `scheduleSnapshot(uint256 time)` | Role-restricted (snapshot scheduler/admin authorized) | SnapshotEngine `ISnapshotScheduler`. | n | — | No snapshot module. |
| 26 | Reschedule a snapshot | `rescheduleSnapshot(uint256 oldTime, uint256 newTime)` | Role-restricted (snapshot scheduler/admin authorized) | `newTime` must stay between adjacent scheduled snapshots (not before previous / not after next). | n | — | No snapshot module. |
| 27 | Unschedule a snapshot | `unscheduleLastSnapshot(uint256 time)` / `unscheduleSnapshotNotOptimized(uint256 time)` | Role-restricted (snapshot scheduler/admin authorized) | `unscheduleLastSnapshot` is restricted to the latest scheduled snapshot; `unscheduleSnapshotNotOptimized` supports generic unscheduling. | n | — | No snapshot module. |
| 28 | Snapshot time | `getAllSnapshots()` / `getNextSnapshots()` | Public (`view`) | Returns created snapshot times and pending scheduled times. | n | — | No snapshot module. |
| 29 | Snapshot total supply | `snapshotTotalSupply(uint256 time)` | Public (`view`) | `ISnapshotState`. | n | — | No snapshot module. |
| 30 | Snapshot balance | `snapshotBalanceOf(uint256 time, address tokenHolder)` | Public (`view`) | `ISnapshotState` (see also `snapshotInfo`). | n | — | No snapshot module. |
##### Note
> This subsection can be used to detail snapshot scheduling and query behavior, including timing constraints and permission specifics.



#### Dividend (optional)

| ID | Requirement | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 31 | Distribution create parameters |  |  |  | n | — | No on-chain dividend / distribution module. Distributions are handled out-of-band by the issuer. |
| 32 | Distribution set eligibility |  |  |  | n | — | No dividend module. |
| 33 | Distribution set deposit |  |  |  | n | — | No dividend module. |
| 34 | Distribution claim deposit |  |  |  | n | — | No dividend module. |
| 35 | Distribution schedule |  |  |  | n | — | No dividend module. |
| 36 | Distribution unschedule |  |  |  | n | — | No dividend module. |
##### Note
> This subsection can be used to detail dividend/distribution workflow specifics and jurisdiction- or product-specific handling rules.
> No direct CMTAT Solidity equivalent is currently defined for these items; they are implementation-specific. However, a prototype is available on the CMTA GitHub organization: https://github.com/CMTA/IncomeVault

#### Credit Events (optional)
| ID | Requirement | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 37 | Flag as default | `setCreditEvents(CreditEvents)` -> `creditEvents().flagDefault` | Role-restricted (issuer/compliance/admin authorized) | Managed in `ICMTATCreditEvents.CreditEvents`. | n | — | No credit events module; the contract is intended for equity, not debt. |
| 38 | Remove default flag | `setCreditEvents(CreditEvents)` with `flagDefault = false` | Role-restricted (issuer/compliance/admin authorized) | Same function as 1.29 with different value. | n | — | No credit events module. |
| 39 | Flag as redeemed | `setCreditEvents(CreditEvents)` -> `creditEvents().flagRedeemed` | Role-restricted (issuer/compliance/admin authorized) | Managed in `ICMTATCreditEvents.CreditEvents`. | n | — | No credit events module. |
| 40 | Set rating | `setCreditEvents(CreditEvents)` -> `creditEvents().rating` | Role-restricted (issuer/compliance/admin authorized) | Managed in `ICMTATCreditEvents.CreditEvents`. | n | — | No credit events module. |
##### Note
> This subsection can be used to detail how credit event states are updated, governed, and audited in the implementation being approved.



### Debt (optional)
| ID | Attribute | CMTAT Solidity corresponding feature | Access Control (CMTAT Solidity) | Notes | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|---|
| 41 | Guarantor identifier | `debt().debtIdentifier.guarantor` (set via `setDebt`) | Read: public (`view`); write: role-restricted (`setDebt`) | Debt module (`ICMTATDebt.DebtIdentifier`). | n | — | No debt module; equity instrument. |
| 42 | Debtholder representative identifier | `debt().debtIdentifier.debtHolder` (set via `setDebt`) | Read: public (`view`); write: role-restricted (`setDebt`) | Debt module (`ICMTATDebt.DebtIdentifier`). | n | — | No debt module. |
| 43 | Unique identifier / hash | `tokenId()` and `terms().doc.documentHash` | Public (`view`) | `tokenId` is optional (implementations MAY omit it); document hash is in `terms` metadata. | partial | Public (`view`) | `Shares` exposes a `tokenId` string (e.g. an ISIN), but `terms` stores a URL only — there is no on-chain document hash. `SharesUnderAgreement` has neither `tokenId` nor a document hash. |
| 44 | Issuance date | `debt().debtInstrument.issuanceDate` (set via `setDebt` / `setDebtInstrument`) | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`ICMTATDebt.DebtInstrument`). | n | — | No debt module. |
| 45 | Currency of payments | `debt().debtInstrument.currency` / `debt().debtInstrument.currencyContract` | Read: public (`view`); write: role-restricted (`setDebt*`) | Supports symbol-like string and token/asset contract address. | n | — | No debt module. |
| 46 | Par value | `debt().debtInstrument.parValue` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`uint256`). | n | — | No debt module. |
| 47 | Minimum denomination | `debt().debtInstrument.minimumDenomination` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`uint256`). | n | — | No debt module. |
| 48 | Maturity date | `debt().debtInstrument.maturityDate` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`string`). | n | — | No debt module. |
| 49 | Interest rate | `debt().debtInstrument.interestRate` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`uint256`). | n | — | No debt module. |
| 50 | Coupon payment frequency | `debt().debtInstrument.couponPaymentFrequency` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`string`). | n | — | No debt module. |
| 51 | Interest schedule format: A) start date/end date/period; B) start date/end date/day of period; C) date 1/date 2/date 3 | `debt().debtInstrument.interestScheduleFormat` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`string`). | n | — | No debt module. |
| 52 | Interest payment date: A) period; B) specific date | `debt().debtInstrument.interestPaymentDate` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`string`). | n | — | No debt module. |
| 53 | Day count convention | `debt().debtInstrument.dayCountConvention` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`string`). | n | — | No debt module. |
| 54 | Business day convention | `debt().debtInstrument.businessDayConvention` | Read: public (`view`); write: role-restricted (`setDebt*`) | Debt module (`string`). | n | — | No debt module. |
##### Note
> This subsection can be used to detail supplementary attributes and to explain specific representation or governance choices made by the implementation being approved.



## Guideline for New Blockchain Implementations

If you create a version for another blockchain, use this section to build a correspondence table between the CMTAT framework, the CMTAT Solidity version, and your implementation.

### Freeze

To be compatible with [ERC-3643](https://eips.ethereum.org/EIPS/eip-3643), freeze is implemented with a single function: `setAddressFrozen(targetAddress, frozenStatus)`.

For non-EVM blockchains, implementations MAY separate this into two distinct functions:

```solidity
freeze(address targetAddress)
unfreeze(address targetAddress)
```

##### Note

> This subsection can be used to detail the choice made by the implementation being approved.

This implementation uses neither the ERC-3643 single-function form nor a dedicated `freeze`/`unfreeze` pair. Freezing is expressed through the allowlist state machine: `setType(account, TYPE_RESTRICTED)` freezes and `setType(account, TYPE_FREE)` (or `TYPE_ALLOWED`) unfreezes, both `onlyOwner`. A `RESTRICTED` address can neither receive tokens nor send to anyone other than an `ADMIN` address, which satisfies the "block transfers to and from a given address" requirement.



### CMTAT Extended

In the table below, the CMTAT framework extended features are mapped to Solidity features.

| CMTAT Functionalities | CMTAT Solidity corresponding features | CMTAT Allowlist | CMTAT Light | CMTAT Debt | CMTAT Standard | Present in implementation being approved (`y/n`) | Implementation details |
|---|---|---|---|---|---|---|---|
| On-chain snapshot | `snapshotModule` and `snapshotEngine` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | n | No snapshot module. |
| Forced transfer | `forcedTransfer` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | partial | No issuer-discretionary forced transfer. Time-locked equivalents: `Recoverable.recover` (184-day delay, holder can veto) and, in `SharesUnderAgreement`, the `DragAlong` drag-along (20-day veto window). See item 17. |
| Forced burn | `forcedBurn` | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | partial | No standalone `forcedBurn`. Issuer burns via the time-locked `Recoverable.burn(lostAddress[, balance])` (onlyOwner, 184-day delay). See item 10. |
| Freeze partial token | `freezePartialTokens` / `unfreezePartialTokens` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | n | Whole-address freeze only (`TYPE_RESTRICTED`); no per-amount partial freeze. |
| Integrated whitelisting/allowlisting | CMTAT Allowlist | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | y | Integrated `ERC20Allowlistable` (Free / Allowed / Restricted / Admin states), toggled by `setApplicable`. See item 21. |
| External whitelisting/allowlisting | CMTAT with rule whitelist | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | n | No external/pluggable rule whitelist; allowlisting is built in. |
| RuleEngine / transfer hook | CMTAT with RuleEngine | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | partial | No external pluggable RuleEngine, but a built-in `_beforeTokenTransfer` hook (in `ERC20Allowlistable`) enforces both the allowlist and the global pause on every transfer. |
| Upgradeability | CMTAT Upgradeable version | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | partial | Not a proxy/storage-upgradeable contract (state and logic are immutable once deployed). Functional upgrades are achieved by migrating to a new contract: successor token + `migrate` in `Shares`, and the `Modification` module in `SharesUnderAgreement`. |
| Fee payer / gasless | CMTAT with ERC-2771 module | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #b00020;">&#x2718;</span></strong> | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | n | No ERC-2771 meta-transaction / gasless module. |

##### Note

> This section can be used to detail supplementary features implemented beyond the mandatory baseline and specific cases in the target chain.  
> For non-EVM blockchains, it MAY be relevant to explain how gasless/gas sponsorship and upgradeability work in the particular blockchain targeted.

### Forced Burn and Forced Transfer

In the standard burn function, tokens from a frozen wallet MUST NOT be burnable. CMTAT offers `forcedTransfer` to force a transfer or a burn.

If `forcedTransfer` is not available, implementations MAY implement only `forcedBurn` (as in CMTAT Light). Implementations MAY also implement both. In that case, only `forcedBurn` SHOULD burn tokens, and `forcedTransfer` SHOULD NOT burn tokens.

With the CMTAT Solidity version, when `forcedTransfer` is available, `forcedBurn` is not implemented to reduce contract code size. This limitation MAY not apply to other blockchains.

##### Note

> This subsection can be used to detail the choice made by the implementation being approved.

This implementation provides neither `forcedTransfer` nor `forcedBurn` as an unconditional, issuer-discretionary operation. Instead, the issuer's ability to seize or cancel a holder's balance is deliberately constrained by a 184-day time-lock (`Recoverable`), during which the affected holder can veto the action via `cancelRecovery`. This design choice reflects the legal position that the token holder is the rightful owner of the underlying security (article 973d CO): the issuer cannot silently move or destroy tokens, and the time-lock mirrors the cancellation/annulment safeguards of Swiss CO art. 983. The drag-along mechanism in `SharesUnderAgreement` is the only path to a forced change of ownership, and it is governed by the shareholder agreement (proposal, 20-day veto window, payment to the seller) rather than by issuer discretion.

### Implementation Details

| Functionalities | CMTAT Solidity | Access Control (CMTAT Solidity) | Note | Present in implementation being approved (`y/n`) | Access Control (implementation being approved) | Implementation details |
|---|---|---|---|---|---|---|
| Mint while pause | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | Role-restricted (minter/issuer authorized) | Dedicated cross-chain mint (for example `crosschainMint`) cannot be performed while paused. | n (deviation) | onlyOwner | Differs from CMTAT Solidity: the global pause flag is checked in `_beforeTokenTransfer`, which `_mint` also passes through, so minting reverts with `TransfersPaused` while paused. |
| Burn while pause | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | Role-restricted (burner/issuer authorized) | Dedicated cross-chain burn (for example `crosschainBurn`) cannot be performed while paused. | n (deviation) | onlyOwner | Differs from CMTAT Solidity: `_burn` also passes through `_beforeTokenTransfer`, so burning reverts while paused. Pause is total: no transfer, mint, burn, recovery, or migration can occur until `unpause`. |
| Self-Burn for everyone | <strong><span style="color: #b00020;">&#x2718;</span></strong> | Not permitted | Token holders cannot burn their own tokens; only authorized addresses can burn. | y (deviation, `Shares`) / n (`SharesUnderAgreement`) | Token holder | `Shares` has a burn function that returns the tokens to the issuer and burns them there. This can be used for token holders that agree with the issuer to have their shares returned and issued in a different form (for example traditional shares). `SharesUnderAgreement` has no self-burn; holders exit by unwrapping once the contract is non-binding. |
| Self-Burn for authorized addresses | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | Role-restricted (authorized burner) |  | y | Issuer | The issuer/owner can always burn their own tokens. |
| Standard burn on a frozen address | <strong><span style="color: #b00020;">&#x2718;</span></strong> | Not permitted in standard burn path | Requires `forcedTransfer` or `forcedBurn`. | conditional | onlyOwner | Burning sends tokens to `0x0`. When the allowlist is applicable, `0x0` is `ADMIN`, so a `RESTRICTED` (frozen) sender is permitted to burn — i.e. the owner can burn from a frozen address. When the allowlist is inactive, `0x0` is `FREE` and a transfer from a restricted address reverts, so a frozen balance cannot be burned in that configuration. |
| Burn tokens with `forcedTransfer` | <strong><span style="color: #1e7e34;">&#x2714;</span></strong> | Role-restricted (operator/compliance authorized) | See notes above. | n | — | No `forcedTransfer`. Issuer cancellation uses the time-locked `Recoverable.burn` path instead (see the conditional note above for frozen addresses). |

### Self-Burn

Only the issuer and authorized addresses (not the token holder) can burn a token in CMTAT Solidity, which reflects legal requirements in several jurisdictions.

Once issued, a security can only be cancelled by its issuer, not its holder. Since the token represents the security, the same rule applies. An investor who wants to exit should transfer to the issuer, who can then cancel when legally permitted.

You MAY still add self-burn in your version if it fits your legal or business context.

## Supplementary features

> This section MAY be used to document supplementary features beyond the CMTAT standard that are present in the implementation being approved.

The following features go beyond the CMTAT baseline:

- **Time-locked recovery of lost shares (`Recoverable`).** Anyone can initiate a recovery of a balance to a new address by posting a `DeterrenceFee` deposit; the owner can also initiate recovery or an issuer burn. Execution requires a 184-day delay (`RECOVERY_DELAY`, aligned with Swiss CO art. 983), during which the holder of the "lost" address can cancel it via `cancelRecovery`. This provides a lawful path to restore access to shares whose keys were lost, without giving the issuer unilateral seizure power. `cancelRecoveryOnOwnedContract` lets the owner of a contract-typed holder cancel a recovery targeting it.

- **Deterrence fee (`DeterrenceFee`).** Recovery and drag-along proposals require an ETH deposit (e.g. `deter(1)` / `deter(100)`) to discourage spurious or malicious proposals.

- **ERC-677 `transferAndCall`.** Enables single-transaction transfer-and-notify flows (e.g. wrapping, trading) on top of plain ERC-20 transfers.

- **Successor migration (`Shares`).** The owner can set an `ISuccessorToken` via `setSuccessor`; holders then call `migrate()` / `migrate(amount)` to move their tokens to the successor (the tokens are burned on arrival and the successor is notified to re-issue), supporting voluntary, holder-driven upgrades to a new token version.

- **Mint-and-wrap (`Shares`).** `mintAndWrap` / `batchMintAndWrap` mint base shares and atomically wrap them into a `SharesUnderAgreement`-style wrapper in one transaction, managing the required allowance internally.

`SharesUnderAgreement`-specific supplementary features:

- **Wrapping / unwrapping.** `wrap` escrows base shares 1:1 and mints wrapped shares; `unwrap` (only once the contract is non-binding) burns wrapped shares and returns the proportional base balance via `convertToBase`. `mintFromBase` lets the base token wrap freshly minted shares directly. A `binding` flag controls whether holders may unwrap.

- **Drag-along (`DragAlong`).** `offerAcquisition` lets a buyer make a priced acquisition offer; after a 20-day veto window (during which the owner or any ≥10% holder, or the buyer, can `cancelOffer`), `acceptOffer` force-sells all wrapped shares to the buyer, pays holders in the offered currency, makes the proceeds the new base, and terminates the agreement so holders can unwrap to collect.

- **Governed migration / termination / cancellation (`Modification`).** The owner or any ≥10% holder can `proposeMigration` (move the underlying to a successor), `proposeTermination` (lift the binding), or — owner only — `proposeCancellation` (burn the escrowed base for reissuance elsewhere) and `proposeInternalMigration`. Each proposal has a 20-day veto delay before `executeMigration`, and can be vetoed via `cancelMigration` by the owner or any ≥10% holder.

- **Base-recovery defense.** `cancelBaseRecovery` lets the wrapper defend against an attempt to recover the base tokens it holds in escrow.



## Reference

Submodules used in this project and current checked-out versions:

| Submodule | Repository | Version | Commit |
|---|---|---|---|
| CMTAT | https://github.com/CMTA/CMTAT | `v3.2.0` | `49544f4de1993008acfc9e848d0bf03bd31d8579` |
| SnapshotEngine | https://github.com/CMTA/SnapshotEngine | `v0.3.0-1-g19e0b56` | `19e0b569bf5823aa8cec5760f080a932a9ac940e` |
| RuleEngine | https://github.com/CMTA/RuleEngine | `v3.0.0-rc2-2-g9c0aa70` | `9c0aa70aae08047e4062beab0f89f92bd60252c0` |
| Rules | https://github.com/CMTA/Rules | `v0.3.0` | `91c21c1191e84ff938892267ec443b0d1bb9efb0` |
