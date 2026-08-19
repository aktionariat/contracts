# Proxy & Upgrade Safety — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Proxy pattern and upgrade safety analysis on in-scope contracts

## Findings

### [F-1] Shares and SharesUnderAgreement use clone proxy pattern (EIP-1167) — not upgradeable

**Severity:** INFORMATIONAL
**Location:** `contracts/factories/FactorySource.sol:161,166`

The factories deploy `Shares` and `SharesUnderAgreement` using `Deployment._resolveAddressOrDeploy` (which may use clones) and `Clones.cloneDeterministic`. These are minimal proxy clones (EIP-1167), not upgradeable proxies. The logic contract is fixed at deployment. This means:

- Storage layout is determined by the implementation contract
- No upgrade path exists
- The `_disableInitializers()` call in constructors (lines 92-93 of both `Shares.sol` and `SharesUnderAgreement.sol`) prevents re-initialization of the implementation contract

**Status:** No vulnerability — this is the intended design. The clone pattern is non-upgradeable.

---

### [F-2] BridgedSharesUnderAgreement uses OZ Initializable but is also non-upgradeable

**Severity:** INFORMATIONAL
**Location:** `contracts/multichain/BridgedSharesUnderAgreement.sol:86-92`

`BridgedSharesUnderAgreement` uses `Initializable` from OpenZeppelin and has `initialize()` and constructor with `_disableInitializers()`. It is deployed via `Clones.cloneDeterministic` (non-upgradeable minimal proxy). The `Initializable` pattern is used for clone initialization, not upgradeability.

**Status:** No vulnerability — correct use of Initializable for clone pattern.

---

### [F-3] FactorySource deploy: potential front-running of CREATE2 deployment

**Severity:** MEDIUM
**Location:** `contracts/factories/FactorySource.sol:161`

`Clones.cloneDeterministic(SHA_IMPLEMENTATION, salt)` uses a deterministic address based on the `salt`. If an attacker observes the `salt` before the transaction is mined, they could deploy a contract at the same address using CREATE2. However, since the `SHA_IMPLEMENTATION` is fixed and the `salt` is controlled by the factory owner, this is only exploitable if the `salt` is predictable (e.g., derived from public data).

**Recommendation:** Ensure `salt` is not predictable from public data, or use `Clones.clone` (non-deterministic) if address predictability is not required.
