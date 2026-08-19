# Defender — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Release-gate analysis focused on deployment/upgrade safety for in-scope contracts

## Findings

### [F-1] FactorySource: SharesUnderAgreement initialized with owner set to factory, not futureOwner

**Severity:** LOW
**Location:** `contracts/factories/FactorySource.sol:168`

When a new `SharesUnderAgreement` is deployed via `Clones.cloneDeterministic`, it is initialized with `address(this)` (the factory) as the owner. The factory then calls `transferOwnership(futureOwner)` at line 223. If the `CCIPService._applySettingToChainlinkCCIPInfrastructure` call or any subsequent step reverts, the SHA remains owned by the factory with no rollback path. This is a deployment fragility, not an exploit, but should be documented in deploy runbooks.

### [F-2] FactoryDestination: BridgedSharesUnderAgreement pool set before ownership transfer

**Severity:** LOW
**Location:** `contracts/factories/FactoryDestination.sol:156`

`BridgedSharesUnderAgreement(deployment.bridgedSharesUnderAgreement).setPool(deployment.brunMintTokenPool)` is called while the factory still owns the contract. If `setPool` is called a second time (owner can call it), the pool can be changed to an attacker-controlled address. The `setPool` function has no timelock or restriction on re-setting. This is standard owner power but should be noted.

### [F-3] FactorySource: No validation that futureOwner is a valid address before CCIP registration

**Severity:** LOW
**Location:** `contracts/factories/FactorySource.sol:223`

`transferOwnership(futureOwner)` is called at the end of `deploy()`. If `futureOwner` was set to `msg.sender` (line 147) this is safe. But if a caller-provided `futureOwner` is passed, there is no validation that it is a contract or EOA. An `address(0)` would be caught by `Ownable`, but an address with no code could leave admin roles stranded.

### [F-4] No fork-rehearsal evidence for cross-chain deployment scripts

**Severity:** MEDIUM
**Location:** `contracts/factories/`

The `FactorySource` and `FactoryDestination` deploy contracts that interact with Chainlink CCIP infrastructure. The `TokenPoolService._applyChainUpdatesTokenPool` and `CCIPService._applySettingToChainlinkCCIPInfrastructure` functions make multiple external calls to Chainlink contracts. Absence of fork-rehearsal tests for this deployment flow is a HIGH risk for mainnet. The deploy scripts should be tested on a fork with live Chainlink addresses.

**Recommendation:** Add Foundry fork tests that simulate the full `FactorySource.deploy()` and `FactoryDestination.deploy()` flows against a forked mainnet with real Chainlink router/registry addresses.
