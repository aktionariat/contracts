# 🔏 Signature-Replay Analysis — Aktionariat share-token + secondary market

Branch `ai-audit` @ `0064dfb` · 2026-08-11

Skill: `signature-replay-analysis` (EIP-712 typed-data replay, cross-chain replay, cross-domain replay, same-chain replay, time/replay-in-window, ecrecover robustness).

---

## Scope

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In scope**     | `EIP7702/AuthorizedExecutor.sol` · `EIP7702/AuthorizedCall.sol` · `EIP7702/AuthorizedCallVerifier.sol`<br>`market/TradeReactor.sol` · `market/IntentHash.sol` · `market/IntentVerifier.sol` · `market/SecondaryMarket.sol`<br>`multisig/MultiSigWallet.sol` · `multisig/MultichainWallet.sol` · `multisig/MultichainWalletArgumentSource.sol` · `multisig/MultiSigWalletMaster.sol` · `multisig/Nonce.sol` · `multisig/RLPEncode.sol` |
| **Out of scope** | Chainlink CCIP internals (`vendor/`) — only traced how `MultichainWallet` calls the router; fee/multi-chain accounting of `sync` (already covered by the reentrancy report's msg.value-loop finding).                                                                                                                                                                                                                                 |
| **PoCs**         | `tests/AuditSignatureReplayAnalysis.ts` (4 tests, all passing)                                                                                                                                                                                                                                                                                                                                                                        |

---

## Bottom line

**Three exploitable replay-adjacent weaknesses found, all with passing PoCs:**

1. **[MEDIUM] `MultichainWallet._ccipReceive` — out-of-order/stale signer syncs resurrect removed signers** on the destination chain. `allowOutOfOrderExecution: true` (MultichainWallet.sol:66) is set and the payload carries **no sequence number** (MultichainWallet.sol:25-36). A signer-list snapshot broadcast _before_ a signer removal, delivered _after_ the removal, re-applies the removed signer with full power. The removed signer can then move wallet funds (proven end-to-end).
2. **[LOW/MEDIUM] `AuthorizedExecutor.execute` — a signed `AuthorizedCall` has no deadline.** A captured/abandoned signature remains executable at any future time; `contractNonce` is the only guard and there is no revocation path (AuthorizedExecutor.sol:32-40).
3. **[LOW] `TradeReactor` intents — no nonce, unvalidated `creation`, cancellation is only a race.** A signed intent is a cheque live for its entire validity window; it is not invalidated by a newer intent from the same owner and `cancelIntent` (TradeReactor.sol:150) must be won as a mempool race for the whole window.

Plus one INFO note on `ecrecover` robustness (malleable `s`, `v < 27` remap) that is currently not exploitable given sequential nonces and full-payload hashing.

The cross-chain replay question (the headline concern for this system) is **well defended**: every domain separator includes `chainId` + `verifyingContract`, `MultiSigWallet.calculateTransactionHash` bakes in `block.chainid` and a `contractId`, and filler-binding prevents cross-relay reuse of market intents. The weaknesses above are **within-domain** replay / liveness issues, not cross-chain ones.

---

## Method

For each signing path the domain binding, the signed payload, the replay guards, and the time/revocation semantics were mapped:

| Signature path                         | Domain                                                                              | Payload                                                 | Replay guard                             | Time bound                         | Revocation                         |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- | ---------------------------------- | ---------------------------------- |
| `IntentVerifier` (market/TradeReactor) | `TradeIntent` v1, `chainId` **cached at deploy**, `verifyingContract=reactor`, salt | full `Intent` struct                                    | `filledAmount[intent.hash()]` cap        | `expiration` (checked in `verify`) | `cancelIntent` (permissioned race) |
| `AuthorizedCallVerifier` (EIP-7702)    | `AuthorizedCall` v1, `chainId` **dynamic**, `verifyingContract=EOA address(this)`   | full `AuthorizedCall` struct                            | sequential `contractNonce`               | **none**                           | **none**                           |
| `MultiSigWallet.verifySignatures`      | none (raw `ecrecover` over RLP hash)                                                | nonce, contractId, gas(21000), to, value, data, chainId | sequential `Nonce` bitmap (2^127 offset) | none (but nonce-bounded)           | nonce-burning                      |

---

## Finding 1 (MEDIUM) — MultichainWallet: out-of-order signer syncs resurrect removed signers

**File:** `contracts/multisig/MultichainWallet.sol:25-36`, `59-68`

`_ccipReceive` decodes `(address[] signerList, uint8[] powers)` and applies each entry **unconditionally** via `_setSigner(signer, power)` — including `power = 0` to remove a signer. The message carries no monotonic sequence, and the `sync` sender explicitly opts into unordered delivery (`allowOutOfOrderExecution: true`, line 66).

The destination chain therefore has **no notion of "newest snapshot"** — the last-arriving message wins, even if it is older. If a signer is removed on mainnet while an earlier snapshot is still in flight, delivering the stale snapshot after the removal re-adds the removed signer at full power. Because the destination chain is itself a live multisig (see `authorized`/`execute` on the L2 copy), the resurrected signer can immediately co-sign or (if power 1) alone move funds.

### Exploit walkthrough (tests `AuditSignatureReplayAnalysis.ts` Finding 1)

1. `t0` — mainnet signer set is `[alice=1, bob=1]`; a `sync` snapshot is broadcast to the L2 but delayed.
2. `t1` — bob is removed on mainnet (`[alice=1, bob=0]`); the removal sync arrives **first**. `signers(bob) == 0`, `signerCount == 1`. ✓
3. `t2` — the stale `t0` snapshot is delivered out of order. `_ccipReceive` applies it unconditionally → `signers(bob) == 1`, `signerCount == 2`. **Bob is back.**
4. Bob signs a real multisig transaction (`wallet → bob`, 1 ETH, empty data, raw digest signature). `checkSignatures` accepts his signature alone, and `execute` moves 1 ETH out of the wallet.

**Remarks**

- Not a forged-message attack: only the router can call `ccipReceive`. The trigger is genuine out-of-order/duplicate delivery, which the protocol explicitly permits (and which is realistic across reorgs or after a user manually resends a snapshot).
- An attacker cannot manufacture mainnet signer state, so this is _accidental-state_ rather than _steal-keys_; severity Medium (funds exposure on the L2 copy until a corrective sync, which may never be sent because mainnet believes the job is done).

**Fix**

- Add a monotonically increasing sync sequence (mainnet keeps `lastSyncSeq`; only messages with a strictly newer sequence are applied, and the sequence is included in the CCIP payload). Alternatively make `_ccipReceive` a **snapshot-based set replace** keyed by a mainnet-maintained version number, and ignore stale versions.
- If a versioned counter is not desired, at minimum document and require operators to re-broadcast the full signer list after every signer change until delivery is confirmed.

---

## Finding 2 (LOW/MEDIUM) — AuthorizedExecutor: `AuthorizedCall` has no deadline

**File:** `contracts/EIP7702/AuthorizedExecutor.sol:32-40`; `contracts/EIP7702/AuthorizedCallVerifier.sol:44-52`

`AuthorizedCall` contains `{nonce, to, functionSignature, value, data}`. `execute` only checks `call.nonce == contractNonce`, the signature, and the function-signature/data match. There is **no `deadline`, no expiry, and no revocation map**.

The nonce is the _only_ guard. A signature is valid for as long as `contractNonce` stays at the signed value — i.e. indefinitely if the account never executes anything. Any party holding a copy of the signature (an app the user once signed for, a relayer, a mempool observer, an abandoned session) can execute it at an arbitrarily later time, including long after the user changed their mind, without any consent refresh. The user's only countermeasure is to race the nonce by executing a dummy call — the same race problem as Finding 3.

### Exploit walkthrough (test Finding 2)

1. `signer1` signs an `approve(tradeReactor, 1000 ZCHF)` `AuthorizedCall` and never executes anything.
2. The test advances **180 days**.
3. Anyone (`deployer`) executes the stale signature: `execute` succeeds, the allowance is granted. Only afterwards does `contractNonce` move to 1, and the same signature now reverts.

**Fix**

- Add `deadline` to `AuthorizedCall` (signed, so it cannot be forged) and revert in `execute` when `block.timestamp > call.deadline`.
- Consider a `revokedCalls` map or a `cancelAll()` that bumps `contractNonce`, so a user who signs-and-regrets can invalidate outstanding signatures without racing.

---

## Finding 3 (LOW) — TradeReactor intents: no nonce; stale intent live for the whole window; `cancelIntent` is a race

**File:** `contracts/market/TradeReactor.sol:118-163`; `contracts/market/IntentVerifier.sol:29-36`

Intent replay is capped **per intent hash** by `filledAmount` and bounded in time by `expiration` — both sound. But there is no nonce/version field, and `creation` is never validated. Consequences:

1. **Replay-in-window:** a signed intent is a cheque that any filler can execute at an attacker-chosen time anywhere inside its validity window. The signer cannot shorten the window or invalidate the cheque once it leaves their hands.
2. **No supersede:** signing a _newer_ intent (e.g. at a better price) does nothing to an older outstanding intent — both are live until each expires or is cancelled.
3. **Cancellation is a race:** `cancelIntent` (TradeReactor.sol:150-153) sets `filledAmount = uint256.max`, but a filler who wants the fill simply out-bids the cancellation in the mempool; the owner must win the race for the _entire_ window. Post-fill cancellation does not undo anything.

### Exploit walkthrough (test Finding 3)

1. Seller signs public intent A: 20 SH → 200 CHF, valid 1 h.
2. 30 minutes later the seller signs a better-priced intent B (300 CHF) — `filledAmount` untouched by intent B.
3. Any filler (`signer3`) executes the **stale** intent A with a buyer at 200 CHF. The trade settles; the seller's better intent B never factored in.
4. Post-fill `cancelIntent(A)` flips the flag but cannot undo the executed transfer.

The economic impact is bounded (the owner signed the price), so this is LOW / liveness-and-ux: it is the same class of "stale order is live until expiry" behaviour every order-book/intent system faces, but it is _worse_ than necessary because there is no per-owner nonce.

**Fix**

- Add a per-owner (or per-owner/per-token) monotonically increasing nonce to the signed `Intent`, and reject fills of intents whose nonce is behind the owner's current one. Signing intent B then implicitly invalidates intent A.
- At minimum, keep `creation` in the price path but document that `getTotalExecutionPrice` (TradeReactor.sol:100-104) trusts the signer-chosen `creation` ordering.

---

## Finding 4 (INFO) — raw `ecrecover` robustness

**Files:** `IntentVerifier.sol:45-63` · `AuthorizedCallVerifier.sol:44-65` · `MultiSigWallet.verifySignatures:152-168`

All three verifiers use raw `ecrecover` with `v` remapped when `< 27` (IntentVerifier.sol:59), and none reject high-`s` (malleable) signatures. Today this is **not exploitable**: the signed payload is fully bound (nonce/hash/filledAmount), so a malleated variant produces the _same_ recovered signer, and sequential nonces prevent same-hash double use. It is flagged for robustness: prefer `ECDSA.tryRecover`/`SignatureChecker` (which enforce `s <= secp256k1n/2` and `v ∈ {27, 28}`), and never use the recovered address as a storage key without checking it is non-zero (currently done).

Related design note (INFO): `IntentVerifier` caches `block.chainid` in `DOMAIN_SEPARATOR` at deployment (IntentVerifier.sol:29-36). This is _safe by default_ (signatures are bound to the deployment chain and cannot leak to other chains), but it means a reactor deployed at the same address on a chain whose id changes (fork/sidechain) would keep accepting signatures made under the old chain id. `AuthorizedCallVerifier` computes the domain **dynamically** (AuthorizedCallVerifier.sol:33-42) — that is the pattern to standardize on.

---

## Verified non-findings (defense-in-depth confirmed)

| Concern                                              | Result                                                                                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-chain replay of intents (`TradeIntent` domain) | ✅ Domain includes `chainId` (cached at deploy, so even safer) + `verifyingContract` + salt.                                                                                           |
| Cross-chain replay of `AuthorizedCall`               | ✅ Dynamic domain includes `block.chainid` and `address(this)` = the EOA.                                                                                                              |
| Cross-chain replay of multisig txs                   | ✅ `calculateTransactionHash` includes `block.chainid` and `contractId` (uint32(address) ^ chainid); `Nonce` bitmap uses 2^127 offset to prevent re-use as personal-message-style txs. |
| Cross-relay reuse of market intents                  | ✅ `verify` (TradeReactor.sol:144-148) binds `filler`; market intents are filler-locked to the market.                                                                                 |
| Same-intent partial-fill overflow                    | ✅ `OverFilled` guards both sides (TradeReactor.sol:123-124).                                                                                                                          |
| Nonce consumed before external call in `execute`     | ✅ `flagUsed` precedes the call (MultiSigWallet.sol:99-100) — replay with same nonce reverts.                                                                                          |
| EIP-712 verification of `execute`'s actual calldata  | ✅ `verifyAuthorizedCallFunction` (AuthorizedExecutor.sol:45-48) binds signed `functionSignature` to `call.data`.                                                                      |

---

## Running the PoCs

```
npx hardhat test tests/AuditSignatureReplayAnalysis.ts
```

(4/4 pass; the Finding 1 suite runs on a dedicated in-process chainId-31337 network because `_ccipReceive` rejects chainId 1 by design.)
