# 🔐 Security Review — contracts (Aktionariat share-token stack, SCV sweep)

Branch `ai-audit` @ `0064dfb` · 2026-08-11

---

## Scope

|                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode**                   | full-repo SCV sweep (cheatsheet + grep pass + semantic pass + per-finding deep validation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Files reviewed**         | `shares/base/Shares.sol` · `shares/base/Recoverable.sol`<br>`shares/sha/SharesUnderAgreement.sol` · `multichain/BridgedSharesUnderAgreement.sol`<br>`multichain/MultichainWallet.sol` · `multichain/MultiSigWalletMaster.sol`<br>`multichain/MultiSigCloneFactory.sol` · `multichain/CCIPAdministrable.sol`<br>`multichain/MultichainWalletArgumentSource.sol` · `multisig/Rollout.sol`<br>`market/TradeReactor.sol` · `market/SecondaryMarket.sol` · `market/SecondaryMarketFactory.sol`<br>`ERC20/ERC20Allowlistable.sol` · `ERC20/ERC20Named.sol` · `ERC20/ERC20Flaggable.sol`<br>`utils/Ownable.sol` · `utils/DeterrenceFee.sol` · `utils/Deployment.sol`<br>`factories/lib/CCIPService.sol` · `factories/lib/TokenPoolService.sol`<br>`vendor/.../pools/LockReleaseTokenPoolProxy.sol` · `vendor/.../pools/BurnMintTokenPoolProxy.sol` |
| **Reference classes hit**  | [`insufficient-access-control`](../.claude/skills/scv/references/insufficient-access-control.md) · [`msgvalue-loop`](../.claude/skills/scv/references/msgvalue-loop.md) · [`dos-revert`](../.claude/skills/scv/references/dos-revert.md) · [`reentrancy`](../.claude/skills/scv/references/reentrancy.md) · [`unchecked-return-values`](../.claude/skills/scv/references/unchecked-return-values.md) · [`unsafe-low-level-call`](../.claude/skills/scv/references/unsafe-low-level-call.md)                                                                                                                                                                                                                                                                                                                                                 |
| **Proof-of-concept tests** | `test/AuditScv.ts` (16 tests, all passing — 12 PoC tests + the 4-test `Intent.ts` signing suite that the file imports)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Confidence threshold**   | — (confirmed findings only; all reproduced end-to-end)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Each finding is reproduced end-to-end by a Hardhat PoC in `test/AuditScv.ts` — run with `npx hardhat test test/AuditScv.ts`.

Findings 1–2 are new to this review. Findings 3–5 were reported by the prior pass and are re-verified here unchanged.

---

## Findings

### 1. Unprotected `initialize()` lets anyone seize ownership of the share-token family — unlimited mint, broken bridge peg

**File:** `shares/base/Shares.sol` L98-104 · `shares/sha/SharesUnderAgreement.sol` L99-109 · `multichain/BridgedSharesUnderAgreement.sol` L95-101
**Severity:** Critical

**Description**
`Shares`, `SharesUnderAgreement` and `BridgedSharesUnderAgreement` all expose `initialize(...) public initializer` as a "proxy constructor", but none of the constructors call `_disableInitializers()` (or otherwise consume the initializer). After deployment the OZ `initializer` guard is still unset, so **anyone** can call `initialize` on the live contract and become `owner`. Because `initialize` re-runs `__Ownable_init(_owner)` (and for SHA/bridged tokens also re-sets `base`/`terms`), the attacker overwrites the issuer's owner slot. `_disableInitializers()` is absent from the entire codebase.

**Impact**

- `Shares`: the attacker becomes owner → `mint`/`batchMint` (unbounded supply inflation), `setType`/`freeze`/`pause` (allowlist and transfer lockdown), `setSuccessor`, `setTerms`.
- `SharesUnderAgreement`: attacker is owner → controls the allowlist, pause, `freeze`, terms and can re-point `base`.
- `BridgedSharesUnderAgreement`: attacker is owner → calls `setPool(attacker)` and then `mint(attacker, X)` (the `onlyPool` check trivially passes because the attacker named themselves the pool). The remote supply, which must equal the amount locked in the home-chain pool, can be inflated arbitrarily — burning real locked value for freshly minted bridged tokens.

**Code**

```solidity
// Shares.sol — constructor never disables the initializer
constructor(string memory _symbol, string memory _name, string memory _terms, address _owner)
    ERC20Named(_symbol, _name, 0, _owner) ERC20Allowlistable() DeterrenceFee(0.01 ether)
{
    terms = _terms;
}

// Anyone, any time after deployment:
function initialize(string memory _symbol, string memory _name, string memory _terms, address _owner) public initializer {
    __ERC20Named_init(_symbol, _name, 0, _owner); // overwrites owner with attacker
    __DeterrenceFee_init(0.01 ether);
    terms = _terms;
}
```

**PoC** (`test/AuditScv.ts`, Finding 1): for `Shares` the attacker calls `initialize("EVIL", …, attacker)` → `owner() == attacker`, then mints 1000 shares. For `BridgedSharesUnderAgreement` the attacker additionally `setPool(attacker)` and mints 1000 — `totalSupply()` is inflated with no home-chain backing.

**Recommendation**
Call `_disableInitializers()` at the end of each constructor (the standard "constructor + `_disableInitializers`" pattern for contracts that are deployed directly but keep an initializer for proxy use). Since the current stack deploys these contracts via constructors only, `initialize` becomes non-callable and ownership can no longer be stolen; the proxy path must instead keep the `initializer` guard and be initialized in the same transaction as deployment.

---

### 2. `MultichainWallet.sync` reuses `msg.value` in a loop — the wallet's own ETH pays for other chains' fees

**File:** `multichain/MultichainWallet.sol` L38-42 (array overload) · L54-87 (inner `sync`, esp. L79-82)
**Severity:** High

**Description**
`sync(uint64[] targets, address[] signerList, address feeToken_)` (L38) loops over `targets` and re-invokes the payable `sync(uint64, address[] memory, address)` for each chain. `msg.value` is **constant for the whole transaction**; it is never decremented. So on every loop iteration the fee guard `if (msg.value < fee) revert InsufficientNativeFeeToken(...)` (L79) is re-evaluated against the _original_ payment, and each iteration's fee is drawn from the wallet's aggregate balance (the sender's ETH + the wallet's pre-existing ETH). A caller who pays the fee for **one** chain therefore makes the wallet's own balance pay for **every subsequent** chain. The refund line `payable(msg.sender).call{value: msg.value - fee}` (L82) is also recomputed from the stale `msg.value` and can try to send back funds that are no longer in the contract (silently failing, unchecked return value). If the wallet balance runs out mid-loop, the whole sync reverts.

This matches the `msgvalue-loop` reference class exactly: the function neither validates the total cost upfront nor tracks a remaining-ETH local.

**Impact**

- Anyone can force the multisig wallet to spend its own ETH on CCIP message fees (the funds go to the CCIP router, depleting the wallet's custodied balance), repeated at the attacker's own per-chain cost.
- Multi-chain syncs are paid for incorrectly and revert when the wallet balance is insufficient — griefing the sync flow.

**Code**

```solidity
function sync(uint64[] calldata targets, address[] calldata signerList, address feeToken_) external payable {
    for (uint i=0; i<targets.length; i++){
        sync(targets[i], signerList, feeToken_);   // msg.value is the SAME on every iteration
    }
}
...
        if (msg.value < fee) revert InsufficientNativeFeeToken(msg.value, fee);
        msgId = IRouterClient(getRouter()).ccipSend{value: fee}(chain, message);
        if(msg.value - fee > 0) payable(msg.sender).call{value: msg.value - fee}(""); // stale refund
```

**PoC** (`test/AuditScv.ts`, Finding 2): with a mock CCIP router charging 1 ETH/message and the wallet holding 5 ETH, `sync([A, B], …, { value: 1 ETH })` collects 2 ETH in router fees while the wallet's balance drops by exactly 1 ETH — the caller's 1 ETH covered chain A and the wallet's own balance covered chain B. Control: a single-chain `sync` with the correct value leaves the wallet balance unchanged. Third test: with 0.5 ETH in the wallet the two-chain call reverts (griefing).

**Recommendation**
Compute the total fee for all `targets` first and validate it against `msg.value` once, tracking a remaining-ETH local that is decremented per iteration (see the `msgvalue-loop` remediation):

```solidity
function sync(uint64[] calldata targets, address[] calldata signerList, address feeToken_) external payable {
    uint256 remaining = msg.value;
    for (uint i=0; i<targets.length; i++){
        remaining = _sync(targets[i], signerList, feeToken_, remaining);
    }
}
```

and have the inner `sync` take and return the remaining value instead of re-reading `msg.value`; perform the overpayment refund only once, after the loop, against the truly remaining balance. Better: use `feeToken` (ERC-20) for multi-chain syncs so each iteration pulls its own fee from the sender.

---

### 3. Filler-controlled `totalFee` lets anyone pocket 100% of a seller's proceeds _(pre-existing, re-verified)_

**File:** `market/TradeReactor.sol` L118, L137-138
**Severity:** High

**Description**
`TradeReactor.process` accepts `totalFee` as a caller-supplied parameter and pays it to `msg.sender` out of the seller's proceeds. There is no fee schedule, cap, or link to the signed intents — the only bound is the 0.8 underflow at `totalExecutionPrice - totalFee`, so a filler may set `totalFee` to the entire execution price. The 5% cap in `SecondaryMarket` only protects orders routed through the market; `process` is public and any filler can call it directly on intents signed with `filler == address(0)`, bypassing the market's fee logic.

**PoC** (`test/AuditScv.ts`, Finding 3): fair fee leaves the seller 147 of 150; exploit call leaves the seller `0` and credits the filler with the full 150.

**Recommendation**
Derive `totalFee` inside `process` from a stored fee schedule (like `SecondaryMarket`'s `tradingFeeBips`) instead of trusting the caller, and re-emit the `Trade` event with the actual fee.

---

### 4. `Shares.burn` auto-allowlists address(0), silently corrupting the registry's default type and bricking all future mints _(pre-existing, re-verified)_

**File:** `ERC20/ERC20Allowlistable.sol` L187-192
**Severity:** Medium

**Description**
The admin auto-allowlist branch writes `FLAG_INDEX_ALLOWED` onto the recipient of any transfer whose sender is an ADMIN. When an ADMIN account is burned, `_beforeTokenTransfer(admin, address(0), …)` treats the zero address as the recipient and flips address(0) to ALLOWED. `defaultType()` only inspects the ADMIN flag, so it keeps reporting `TYPE_FREE` while `isAllowed(address(0))` is now `true` — an unrecoverable divergence in the "null address = global default" scheme. Every subsequent `mint` to an un-allowlisted (FREE) recipient then reverts with `Allowlist_ReceiverNotAllowlisted`.

**PoC** (`test/AuditScv.ts`, Finding 4): after `burn(30)` by an ADMIN-configured issuer, `isAllowed(address(0)) == true` while `defaultType() == 0`, and `mint(signer2, 50)` reverts.

**Recommendation**

```diff
-            if (isAdmin(from)) {
+            if (isAdmin(from) && to != address(0x0)) {
                 setFlag(to, FLAG_INDEX_ALLOWED, true);
                 emit AddressTypeUpdate(to, TYPE_ALLOWED);
             }
```

---

### 5. Permissionless recovery lets a stranger seize a live holder's entire balance; the deterrence fee is silently swallowed when the owner cannot receive ETH _(pre-existing, re-verified)_

**File:** `shares/base/Recoverable.sol` L73, L77, L126 · `utils/DeterrenceFee.sol` L57-61
**Severity:** Medium

**Description**
`initRecovery(address)` is permissionless and requires no proof that the target address is actually lost; `recover` is also permissionless and pays the full balance to the stored recipient. A dormant holder who cannot cancel within `RECOVERY_DELAY` loses their entire position. The 0.01 ETH deterrence fee is forwarded with an ignored return value — `(bool success, ) = payable(owner).call{value: fee}("")` — so if the owner cannot receive ETH (e.g. a contract without `receive()`/`fallback()`), the fee is silently dropped and enforcement is void.

**PoC** (`test/AuditScv.ts`, Finding 5): (a) attacker registers a recovery on a live holder, advances 184 days, calls `recover`, and receives the full 100-share balance; (b) with a non-receiving contract as owner, `initRecovery` with `value: 0.01 ETH` succeeds while the owner's balance is unchanged.

**Recommendation**
Revert when the fee transfer fails (`if (!success) revert FeeTransferFailed(fee);`), and gate `initRecovery` on an opt-in proof-of-loss signal (or a meaningful, forfeitable stake) rather than any address.

---

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 1     |
| High     | 2     |
| Medium   | 2     |
| Low      | 0     |
| Info     | 0     |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path was not completed. Not scored._

- **`_disableInitializers()` is missing everywhere** — `MultiSigWalletMaster.initialize` (multichain path) and the CCIP `LockReleaseTokenPoolProxy`/`BurnMintTokenPoolProxy` clones also never consume the initializer in their constructors. The master/factory path initializes in the same transaction as clone creation, so there is no current front-running window, but a two-step deploy (deploy proxy, initialize later) would be wide open. Defense-in-depth fix: `_disableInitializers()` in every implementation constructor.
- **`MultichainWallet.sync` ignores the refund call result** (`MultichainWallet.sol:82`) — unchecked low-level call. Combined with the stale `msg.value` (Finding 2) the refund can silently fail, and even with the fix in place the success flag should be honored or the refund done via `transfer`/revert.
- **`sync` on remote chains with zero signers** — `MultiSigCloneFactory.create` passes `address(0)` as owner on non-mainnet chains, leaving the cloned wallet without any signer until a CCIP sync lands; the window between clone deployment and first sync means the wallet cannot execute anything.
- **Allowlist "off" still binds allowlisted accounts** — `setApplicable(false)` only flips address(0); previously-allowlisted holders keep their ALLOWED flag and remain unable to trade with FREE addresses after restrictions are disabled.
- **Partial-fill accounting mixes units across intents** — `TradeReactor.process`/`SecondaryMarket`: `filledAmount[buyerIntent.hash()] += tradedTokens` counts shares against a buyer intent whose remaining-capacity guard is denominated in `amountIn` (currency).

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Findings 1–5 are reproduced by passing Hardhat PoCs in `test/AuditScv.ts`; the leads above are unverified trails for manual review.
