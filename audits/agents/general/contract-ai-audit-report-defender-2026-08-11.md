# Aktionariat Contracts — Defender / Release-Execution Review

- **Date:** 2026-08-11
- **Auditor role:** Defender (release-execution lens: deploy path, rehearsal, secrets, upgrade/rollout machinery, reproducibility, post-deploy validation)
- **Review target:** `0064dfb` (`ai-audit`) — share-token + secondary-market + CCIP bridge stack (Ethereum mainnet, Base, Sepolia/Base-Sepolia, Polygon Amoy, Arbitrum, Avalanche, Scroll)
- **Companion review:** `contracts-ai-audit-report-pashov-2026-08-11.md` — contract-level exploit findings (out of scope here, but release-relevant; see Final Notes)
- **What was verified:** hardhat config & networks, `KEYS*.ts`/`KEYS_TEMPLATE.ts`, `.gitignore`, package.json scripts, ignition modules & deployment tasks, `scripts/*` deploy/utility tasks, `scripts/testcases/*` fork rehearsals, multisig rollout/factory/sync code, unit-test coverage, Etherscan verify wiring.

## Verdict

```
VERDICT: PROCEED WITH RISK (testnet / staging scope)
MAINNET RELEASE: BLOCKED until the Blockers/Actions below clear.
```

- The current branch's own CCIP deploy path **fails closed**: no mainnet CCIP routers, token pools, or LINK are configured, and the share-deploy task defaults to testnet networks. A mainnet bridge release cannot accidentally happen today.
- **Blocking for mainnet:** (1) the new factory/bridge flow has zero tests and zero fork rehearsal, (2) production deploy/upgrade modules are untracked — deployed artifacts are not reproducible from repository state, (3) mainnet signing runs on a plaintext mnemonic file.
- Any testnet/staging run should first apply the cheap mitigations in Required Actions (confirmation prompts, chain guards, ownership assertions) — they are near-zero cost and remove whole classes of self-inflicted release errors.

## Top blockers

1. **Production deployments are not reproducible from the repository.** `ignition/modules/aktionariat/*` and `ignition/modules/issuers/*` (66 files, including every production upgrade/rollout) are gitignored and untracked. The code that actually produced mainnet deployments cannot be reviewed or re-executed from the repo. Additionally the build is broken on a fresh clone: `hardhat.config.ts` imports `KEYS.ts` (untracked, no bootstrap documented beyond `KEYS_TEMPLATE.ts`), and `tasks/bridgeTokensTask.ts` imports `types/ethers-contracts` which is gitignored with no committed generation script (`typechain` is installed but not wired into the config, and package.json has no script for it). A clean `git clone && npx hardhat` fails at config load. **[BLOCKER — D-006]**
2. **No rehearsal exists for the release under review.** Zero unit tests reference `FactorySource`, `FactoryDestination`, `TokenPoolService`, `BridgedShares`, `Rollout`, `MultiSigCloneFactory`, or CCIP. The tracked fork "testcases" (`scripts/testcases/*` — AXRAS, EtherForwarder, TokenFactoryPrediction, MultichainWalletRollout, MultisigUpdateV6) deploy **untracked** ignition modules and mostly just log an address; none exercise a bridge round-trip, ownership handoff, or VERSION drift. `hardhatSepolia` forks **baseSepolia** RPC (not Sepolia), so even a "Sepolia rehearsal" runs against Base-Sepolia state, and the `default` network silently forks mainnet. **[HIGH — D-009/D-014]**
3. **Mainnet signer is a plaintext BIP39 mnemonic.** `hardhat.config.ts` derives all network accounts (including `mainnet`) from `KEYS.mnemonics.*`; ownership transfers, factory-update calls, and deployer EOA writes all execute from it. One untracked file on the working disk controls every network's deployer. It is currently gitignored (not a committed secret), but this is the documented production signing path with no keystore/hardware alternative, and it escalates to BLOCKER if the file is ever shared, committed, or backed up outside the machine. **[HIGH — D-003]**

## Findings

| #   | Severity | Title                                                                                                                                                                                                       |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | BLOCKER  | Production deploy/upgrade modules untracked; fresh clone cannot build → unreproducible deployments                                                                                                          |
| 2   | HIGH     | No tests or fork rehearsal for the CCIP factory/bridge flow; "rehearsals" run untracked modules on wrong fork state                                                                                         |
| 3   | HIGH     | Mainnet deployer is a plaintext mnemonic file (KEYS.ts)                                                                                                                                                     |
| 4   | HIGH     | `Rollout.rollout` permissionless with public deterministic salt (42) → front-run poisons the cciprouter permanently                                                                                         |
| 5   | HIGH     | Deploy task hardcodes "Microstrategy Shares"/"MSTR"; owner defaults to the deployer EOA; BSHA_PARAMETERS covers baseSepolia only                                                                            |
| 6   | HIGH     | No release gates: `npm test` is a broken placeholder; no CI, lint, or typecheck                                                                                                                             |
| 7   | MEDIUM   | Live `hardhatAmoy` sits inside the simulated `hardhat*` family; `hardhatSepolia` forks baseSepolia; `default` silently forks mainnet                                                                        |
| 8   | MEDIUM   | Upgrade modules stale/incomplete: MultisigUpdateV6 asserts VERSION 6 vs code 8 and never wires FactoryManager; UpdateMultisigFactory is a manual hardcoded flow                                             |
| 9   | MEDIUM   | Asset-moving tasks (`ccip-bridge`, `mint-wrap-shares`, `mintBridgedSHA`) have no confirmation prompts or chain guards; `mintBridgedSHA.ts` temporarily breaks the bSHA peg and contains a hardcoded address |
| 10  | MEDIUM   | MultiSigCloneFactory initializes ownerless clones on all non-mainnet chains; an L2 wallet whose CCIP signer-sync never completes is permanently locked — no automation/runbook guarantees sync completion   |
| 11  | MEDIUM   | No post-deploy validation/ownership checklist; FACTORIES_STORAGE empty → re-running deploy-factory-share duplicates infra                                                                                   |
| 12  | LOW      | `ccip-estimate-deployment-gas` computes destination cost via the **source** RPC and hardcodes a Sepolia LINK address                                                                                        |
| 13  | LOW      | Implementation contracts never call `_disableInitializers()` (no clone-takeover path; hygiene only)                                                                                                         |
| 14  | LOW      | `nonce.json` committed and mutated at deploy time; `ignition/deployments` gitignored → no manifest archive                                                                                                  |
| 15  | LOW      | Hardcoded one-off mainnet addresses in tracked scripts (`acceptOwnershipFactory`, `etherscanVerifier`) with no chain guards                                                                                 |
| 16  | LOW      | Stale repo hygiene: README references `src/Shares.sol`, `yarn`, Brokerbot; `hardhat.config.old.ts` duplicate config left behind                                                                             |

---

**1. Production deploy/upgrade modules untracked; fresh clone cannot build** — `ignition/modules/aktionariat/`, `ignition/modules/issuers/`, `hardhat.config.ts:7`, `tasks/bridgeTokensTask.ts:8`, `.gitignore:16`, `package.json` — The contracts themselves are tracked, but the orchestration that deployed them is not, and the typechain artifacts needed to load the config cannot be regenerated by any documented command. Severity is BLOCKER for production reproducibility, MEDIUM for this branch's own testnet path (its deploy module is tracked). Actions: move production modules to a private tracked deployment repo; commit a generation script for `types/ethers-contracts` (or drop the import); document `KEYS_TEMPLATE.ts` bootstrap in README.

**2. No tests or rehearsal for the CCIP factory/bridge flow** — `test/` (77 passing, none touch the new stack), `scripts/testcases/*`, `hardhat.config.ts:57` — Every new contract in this release (`FactorySource`, `FactoryDestination`, `TokenPoolService`, `BridgedShares`, `Rollout`) is unrehearsed; the ones that exist are stale smoke tests. Because `scripts/testcases/*` import untracked modules, none of them can run from a clean clone anyway. `hardhatSepolia` forks baseSepolia (`hardhat.config.ts:57`) so any "Sepolia" rehearsal uses the wrong chain state. Actions: add a committed rehearsal that forks real Sepolia + Base-Sepolia, deploys the full factory→bridge stack, and asserts a CCIP round-trip plus non-EOA ownership.

**3. Plaintext mnemonic mainnet signer** — `KEYS.ts`, `hardhat.config.ts` — Derives every network's accounts from one seed; mainnet `acceptOwnership`/`setMultiSigCloneFactory` execute from these EOAs. Gitignored today, but the blast radius of a leak is all derived accounts across all networks. Actions: keystore-encrypted or hardware-backed signer for mainnet (Foundry keystore is the documented alternative); `chmod 600`; treat KEYS.ts like a wallet.

**4. `Rollout.rollout` is permissionless with a public deterministic salt** — `contracts/multisig/Rollout.sol:9-16` — `rollout(address cciprouter)` has no access control and deploys source/master/factory with the fixed salt `42`. Whoever calls first wins: a front-runner passes an arbitrary `cciprouter`, and since CREATE2 collisions make every later call revert, the canonical deterministic deployment is permanently poisoned (wrong router → broken CCIP signer sync) with no cancel or recover path — the owner must roll out a new salt. Actions: restrict `rollout` to an owner, or salt by `chainid`/`msg.sender`; add a migration path.

**5. Deploy task config drift** — `tasks/deployment/aktionariatSharesInfrastructure.ts:37-39`, `tasks/deployment/parameters/bshaParameters.ts` — `deploy-factory-share` hardcodes `NAME = "Microstrategy Shares"`/`"MSTR"` and defaults `futureOwner` to the deployer EOA; `BSHA_PARAMETERS` defines only `baseSepolia`. A runbook-driven deploy for any other issuer would silently misbrand the token and leave admin on the deployer key. Actions: parameterize name/symbol/owner with no silent defaults; assert owner != deployer before transfer.

**6. No release gates** — `package.json` (`"test": "echo \"Error: no test specified\" && exit 1"`) — The only script is a placeholder; no CI, no lint, no typecheck, no verification gate. Nothing but discipline enforces the gates in this report. Actions: committed CI running compile + unit tests + a fork rehearsal smoke test; fix the `test` script; add lint/typecheck.

**7. Wrong-network footguns** — `hardhat.config.ts:24,45,57` — `hardhatAmoy` is **live** Polygon Amoy while every other `hardhat*` network is a fork/sim; a runbook step or task defaulting to the `hardhat*` family can silently broadcast (testnet impact, but the trap is permanent). `default` forks mainnet, so running any task without `--network` quietly operates on a mainnet fork with confusing outputs. Actions: rename to `amoy-live` / `mainnet-fork`; make the fork fallback loud.

**8. Stale/incomplete upgrade modules** — `scripts/testcases/MultisigUpdateV6.ts` — Claims the multisig update flow but asserts `VERSION == 6` against code that is `0x8`, its `describe` titles say "Deploy on Mainnet" while `switchForkedNetwork("optimism")` targets the optimism fork, and after deploying the new master + factory it never wires `setMultiSigCloneFactory` on the live `FactoryManager` (the update is left to a manual, hardcoded call). This module would fail if run and cannot serve as the upgrade path it purports to be. Actions: finish it or remove it.

**9. Unsafe asset-moving tasks** — `scripts/mintBridgedSHA.ts`, `scripts/ccip-bridge`, `scripts/mint-wrap-shares` — These move real value with no confirmation prompt and testnet-fallback config. `mintBridgedSHA.ts` mints bSHA on one chain ahead of the bridge — temporarily breaking the bSHA peg invariant — with a hardcoded destination address and no chain guard. Actions: add `--confirm` prompts, chain-id guards, and a documented, time-boxed rollback for the peg break.

**10. Ownerless L2 clones can be permanently locked** — `contracts/multisig/MultiSigCloneFactory.sol` — `initialize()` leaves clones ownerless on non-mainnet chains by design (the CCIP sync is expected to set the owner later); there is no automation, test, or runbook proving the signer-sync completes before ownership is handed over. A wallet deployed but never synced is unrecoverable. Actions: add a rehearsal/checklist that asserts owner sync on every L2 deploy.

**11. No post-deploy validation plan** — `FACTORIES_STORAGE` is empty in `tasks/deployment/parameters/factories.ts` and the factory task logs "Consider adding factory ... to FACTORIES_STORAGE"; verification is a manual `ignition verify`. Nothing asserts ownership chains, non-EOA owners, or bytecode-vs-source equality after a release. Actions: post-deploy checklist asserting pauser/owner, `bytes32(0)` on destination chains, and address-book sync.

**12. Cost-estimation copy-paste bug** — `tasks/deployment/ccip-estimate-deployment-gas` computes destination-side cost via the **source** RPC (identical URLs) and hardcodes a Sepolia LINK address; it would silently produce a Base-Sepolia estimate from Sepolia state.

**13. No `_disableInitializers`** — Implementations are only usable through the constructor-initialized clone pattern today; hygiene for future clones, no current exploit path.

**14. Manifest/state hygiene** — `nonce.json` is committed and rewritten by deployments; `ignition/deployments` is gitignored, so deployed addresses live only in local files with no archive.

**15. Hardcoded mainnet addresses** — `scripts/acceptOwnershipFactory.ts`, `scripts/etherscanVerifier.ts` embed one-off mainnet addresses with no chain guard; a mis-targeted run is possible.

**16. Repo hygiene** — `hardhat.config.old.ts` left behind; README references `src/Shares.sol`/`yarn`/Brokerbot and never mentions the `KEYS_TEMPLATE.ts` bootstrap or the `ignition` workflow.

---

## Required actions (before any mainnet release)

1. Write and run a committed fork rehearsal of `FactorySource → FactoryDestination → TokenPoolService → BridgedShares` on real Sepolia + Base-Sepolia state; assert a CCIP round-trip, non-EOA owner/pauser, and bytecode verification. Fix `hardhatSepolia` to fork real Sepolia.
2. Make a fresh clone build: commit a typechain regeneration path or drop the import, document the `KEYS.ts` bootstrap, and move the 66 production modules to a tracked (private) deployment repo.
3. Commit CI: compile + tests + rehearsal smoke test; replace the placeholder `npm test`; add lint/typecheck.
4. Parameterize the share-deploy task (name/symbol/owner, no MSTR hardcode), scope `futureOwner` to an explicit address, add `--confirm` + chain guards to asset-moving tasks, and add ownership assertions to the post-deploy flow.
5. Gate `Rollout.rollout` (owner-only or per-chain salt) and add a recovery path.
6. Finish or delete `MultisigUpdateV6` (fix the VERSION assertion, wire `FactoryManager`).
7. Document the bSHA mint→bridge→wrap sequence as a runbook with a time-boxed rollback for the temporary peg break.

## Final notes

- False confidence: 77 passing unit tests cover none of the new stack; `test/AuditScv.ts` even contains a **passing PoC that `BridgedSharesUnderAgreement` mints unlimited bridged tokens (peg break)** — a known open issue that is part of this deployment set. The pashov HIGHs (filler-controlled `totalFee`, `Shares.burn` allowlist brick, permissionless recovery) are likewise release-relevant despite being out of my scope.
- Etherscan verification is manual; nothing automates the assertion that deployed bytecode equals verified source.
- Rehearsal artifacts are misleading by chain: `default` = mainnet fork, `hardhatSepolia` = baseSepolia fork — treat any existing rehearsal output as wrong-chain evidence until the config is fixed.

> ⚠️ This review was performed by an AI assistant. It assesses release-execution risk, not contract-level exploitability (see the companion pashov report for that). Deployer-side controls (who holds the keys, where the mnemonic lives, who may merge deploy modules) must be confirmed by the team on the actual release machine.
