# Proxy & Upgrade Safety Audit

- **Target:** `contracts/` excluding `contracts/vendor/`
- **Branch:** `ai-audit` @ `0064dfb`
- **Date:** 2026-08-11
- **Method:** initializer, clone, proxy, storage-layout, delegatecall, and upgrade authorization review

## Scope

Reviewed initializer-enabled contracts, `Deployment`, `FactorySource`, `FactoryDestination`, `TokenPoolService`, `CCIPAdministrable`, `BridgedSharesUnderAgreement`, `MultiSigCloneFactory`, `MultiSigWalletMaster`, and related clone/deployment paths. Vendor implementations were treated as dependencies rather than audit targets.

## Finding P-1

### Directly deployed initializer-enabled implementations can be taken over

- **Contract:** `BridgedSharesUnderAgreement`
- **Location:** `contracts/multichain/BridgedSharesUnderAgreement.sol:74-101`
- **Proxy pattern:** clone/initializer-compatible implementation, also deployable directly
- **Class:** uninitialized implementation / initializer takeover
- **Severity:** Medium
- **Confidence:** 95%

`BridgedSharesUnderAgreement` has a constructor that initializes owner-visible state for a normal deployment, but it does not consume the inherited initializer state. Its public `initialize(...)` remains callable after construction. A later caller can invoke it and overwrite the owner through `__ERC20Named_init`, while also resetting terms and deterrence-fee configuration.

The same pattern exists in the initializer-compatible `Shares` and `SharesUnderAgreement` implementations. For clones, initialization must be performed atomically by the factory and the implementation's own storage takeover does not directly alter clone storage. For any implementation or token address deployed directly, however, the public initializer is an ownership takeover surface.

**Attack scenario:**

1. A project deploys `BridgedSharesUnderAgreement` directly, or exposes the implementation address.
2. An attacker calls `initialize(..., attacker)` after deployment.
3. The initializer overwrites the owner in the implementation's storage.
4. The attacker calls owner-only functions such as `setPool`, then uses the new pool authority to mint bridged tokens.

**Impact:**

Direct deployments can lose ownership and, for the bridged token, the attacker can appoint a pool under their control and mint arbitrary supply. A bare clone implementation takeover does not overwrite clone storage, but leaving the implementation callable still creates operational and integration risk and is contrary to standard implementation hardening.

**Recommendation:**

- Add a constructor to every implementation that calls `_disableInitializers()` or otherwise consumes the initializer on the implementation address.
- Ensure every clone is initialized in the same transaction as deployment and verify the initialized owner afterward.
- Avoid supporting both constructor-style direct deployment and proxy-style initialization unless the deployment mode is explicit and tested.
- Add deployment tests that assert the implementation initializer reverts and that every clone has the intended owner.

**PoC:** `tests/AuditProxyUpgradeSafety.ts` confirms that an attacker reinitializes a directly deployed bridged implementation, becomes owner, appoints a malicious pool, and mints tokens.

## Non-findings

- `MultiSigCloneFactory` initializes each clone immediately after deterministic creation; the clone's initializer is protected by `initializer`.
- No project-owned UUPS, Transparent, Beacon, or Diamond upgrade function was found, so no project-owned storage-version collision or `_authorizeUpgrade` bypass was confirmed.
- The implementation takeover is not claimed as a clone-storage takeover; the finding is limited to directly deployed initializer-enabled instances and insufficient implementation hardening.

> This review does not establish the absence of proxy or upgrade vulnerabilities.
