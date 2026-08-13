# 🔐 Security Review — contracts (Aktionariat share-token + secondary market)

Branch `ai-audit` @ `0064dfb` · 2026-08-11

---

## Scope

|                                  |                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode**                         | targeted (market + share-token stack)                                                                                                                                                                                                                                                                                                                    |
| **Files reviewed**               | `market/TradeReactor.sol` · `market/SecondaryMarket.sol`<br>`market/SecondaryMarketFactory.sol` · `market/IntentHash.sol`<br>`market/IntentVerifier.sol` · `ERC20/ERC20Allowlistable.sol`<br>`ERC20/ERC20Flaggable.sol` · `shares/base/Shares.sol`<br>`shares/base/Recoverable.sol` · `shares/sha/SharesUnderAgreement.sol`<br>`utils/DeterrenceFee.sol` |
| **Supporting analysis**          | [`x-ray/x-ray.md`](x-ray/x-ray.md) · [`x-ray/invariants.md`](x-ray/invariants.md)                                                                                                                                                                                                                                                                        |
| **Proof-of-concept tests**       | `test/AuditPoCs.ts` (6 tests, all passing)                                                                                                                                                                                                                                                                                                               |
| **Confidence threshold (1-100)** | 75                                                                                                                                                                                                                                                                                                                                                       |

Each finding below is reproduced end-to-end by a Hardhat PoC in `test/AuditPoCs.ts` — run with `npx hardhat test test/AuditPoCs.ts`.

---

## Findings

```diff
- TradeReactor.process
- Valid Concern:    If intent are signed and sent to a malicious actor, it could drain the seller's
-                   tokenIn balance.
```

[95] **1. Filler-controlled `totalFee` lets anyone pocket 100% of a seller's proceeds**

`TradeReactor.process` · Confidence: 95 · Severity: High

**Description**
`TradeReactor.process` (`TradeReactor.sol:118`) accepts `totalFee` as a caller-supplied parameter and pays it to `msg.sender` (`TradeReactor.sol:138`) out of the seller's proceeds (`TradeReactor.sol:137`). There is no fee schedule, no cap, and no link to the signed intents — the only bound is the 0.8 underflow at `totalExecutionPrice - totalFee`, i.e. the filler may set `totalFee` to the _entire_ execution price. The 5% cap (`SecondaryMarket.sol:105`) only protects orders routed through `SecondaryMarket`, but `TradeReactor.process` is `public` and any filler can call it directly on intents signed with `filler == address(0)` (the "open to any filler" mode), bypassing the market's fee logic entirely. The `Trade` event that would have exposed the discrepancy is commented out (`TradeReactor.sol:141`).

**Attack**
A filler with both signed intents calls `process(seller, sig, buyer, sig, tradedTokens, totalExecutionPrice)` as `msg.sender`. The buyer pays full price, the seller receives `0`, the filler receives the whole trade value. A fair filler would set `totalFee` to a negotiated rate; nothing enforces that choice. Malicious front-runners can also grab publicly-signaled intents and force the max fee.

**Proof** (`test/AuditPoCs.ts`, "Finding 1"): a fair fee leaves the seller 147 of 150; the exploit call leaves the seller `0` and credits the filler with the full `150`.

**Fix**

```diff
- function process(Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig, uint256 tradedTokens, uint256 totalFee) public {
+ // totalFee must be derived on-chain, e.g. from a fee registry, or capped against the intent:
+ // if (totalFee > totalExecutionPrice * MAX_FEE_BIPS / 10000) revert FeeTooHigh();
```

Derive `totalFee` inside `process` from a stored fee schedule (like `SecondaryMarket`'s `tradingFeeBips`) rather than trusting the caller, and re-emit the `Trade` event with the actual fee.

---

[85] **2. `Shares.burn` auto-allowlists address(0), silently corrupting the registry's default type and bricking all future mints**

```diff
- Ask:

Think about the Shares.burn exploit within x-ray/contracts-ai-audit-... and ERC20Allowable, respond to questions:

- what is the starting flag of any address? Is it free or restricted?

```

`ERC20Allowlistable._beforeTokenTransfer` · Confidence: 85 · Severity: Medium

**Description**
The admin auto-allowlist branch (`ERC20Allowlistable.sol:187-192`) writes `FLAG_INDEX_ALLOWED` onto the _recipient_ of any transfer whose sender is an ADMIN. When an ADMIN account is burned, `_beforeTokenTransfer(admin, address(0), ...)` treats the zero address as the recipient and flips address(0) to ALLOWED. Because `defaultType()` only inspects the ADMIN flag (`ERC20Allowlistable.sol:93`), it keeps reporting `TYPE_FREE` while `isAllowed(address(0))` is now `true` — an unrecoverable divergence in the "null address = global default" scheme.

**Attack**
With an issuer configured as ADMIN (`setType(issuer, TYPE_ADMIN)`) and transfer restrictions disabled, a single holder self-burn (`Shares.burn`, which routes `_transfer(holder -> owner)` then `_burn(owner)`) flips address(0) to ALLOWED. Every subsequent `mint` to an un-allowlisted (FREE) recipient goes through `_beforeTokenTransfer(address(0), recipient, ...)`, where `isAllowed(address(0))` now reverts with `Allowlist_ReceiverNotAllowlisted(recipient)` — the company can no longer issue shares to new holders. The flag can only be cleared by an owner call to `setType`, and even then the corruption recurs on the next burn.

**Proof** (`test/AuditPoCs.ts`, "Finding 2"): after `burn(30)` by an ADMIN-configured issuer, `isAllowed(address(0)) == true` while `defaultType() == 0`, and `mint(signer2, 50)` reverts with `Allowlist_ReceiverNotAllowlisted`; the control (no burn) mints fine.

**Fix**

```diff
-            if (isAdmin(from)) {
+            if (isAdmin(from) && to != address(0x0)) {
                  setFlag(to, FLAG_INDEX_ALLOWED, true);
                  emit AddressTypeUpdate(to, TYPE_ALLOWED);
              }
```

---

[80] **3. Permissionless recovery lets a stranger seize a live holder's entire balance; the deterrence fee is silently swallowed when the owner cannot receive ETH**

`Recoverable.initRecovery` / `Recoverable.recover` / `DeterrenceFee.deter` · Confidence: 80 · Severity: Medium

**Description**
`initRecovery(address)` (`Recoverable.sol:73`) is permissionless and requires no proof that the target address is actually lost — any caller can register a recovery of any address with a balance, naming themselves (or anyone) as recipient. `recover(lostAddress)` (`Recoverable.sol:126`) is also permissionless and pays the full balance to the stored recipient. A live holder who is dormant, does not monitor on-chain activity, or is legally barred from canceling within the window loses their entire position after `RECOVERY_DELAY`. The intended deterrent is a 0.01 ETH fee (`DeterrenceFee.sol:57-61`), but the payment is forwarded with an ignored return value — `(bool success, ) = payable(owner).call{value: fee}("")` — so if the owner cannot receive ETH (e.g. a contract without `receive()`/`fallback()`), the fee is silently dropped, enforcement is void, and the attacker's ETH is stranded instead of charged.

**Proof** (`test/AuditPoCs.ts`, "Finding 3"): (a) an attacker registers a recovery on a live holder, advances 184 days, calls `recover`, and receives the full 100-share balance; (b) with a non-receiving contract as owner, `initRecovery` with `value: 0.01 ETH` succeeds while the owner's balance is unchanged — the fee was never delivered.

**Fix**

```diff
-            (bool success, ) = payable(owner).call{value: fee}("");
-            emit DeterrenceFeePaid(msg.sender, fee);
+            (bool success, ) = payable(owner).call{value: fee}("");
+            if (!success) revert FeeTransferFailed(fee);
+            emit DeterrenceFeePaid(msg.sender, fee);
```

Additionally, gate `initRecovery` on an opt-in signal (e.g. the target address having registered as lost, or an on-chain proof-of-loss attestation) rather than any address, or require the proposer to stake a meaningful, forfeitable amount.

---

Findings List

| #   | Confidence | Title                                                                           |
| --- | ---------- | ------------------------------------------------------------------------------- |
| 1   | [95]       | Filler-controlled `totalFee` lets anyone pocket 100% of a seller's proceeds     |
| 2   | [85]       | `Shares.burn` auto-allowlists address(0), bricking all future mints             |
| 3   | [80]       | Permissionless recovery seizes live balances; deterrence fee silently swallowed |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path was not completed. Not scored._

- **Allowlist "off" still binds allowlisted accounts** — `ERC20Allowlistable.setApplicable` — Code smells: flags are never cleared on existing accounts. `setApplicable(false)` only flips address(0); previously-allowlisted holders keep their ALLOWED flag, so the FREE↔ALLOWED transfer matrix still applies to them and they cannot trade with FREE addresses after restrictions are disabled. Worth confirming issuer expectations.
- **Partial-fill accounting mixes units across intents** — `TradeReactor.process`/`SecondaryMarket` — Code smells: `filledAmount[buyerIntent.hash()] += tradedTokens` (`TradeReactor.sol:127`) counts _shares_ against a buyer intent whose remaining-capacity guard (`TradeReactor.sol:124`) is denominated in `amountIn` (currency). The overfill guards G-6/G-7 can disagree on the same intent depending on token decimals. Worth a cross-unit trace.
- **Recovery consumed before the transfer executes** — `Recoverable.prepare` — Code smells: `delete recoveries[lostAddress]` runs before `_transfer`/`_burn`; if the execution reverts (paused token, restricted recipient), the recovery record is gone even though no tokens moved.
- **Owner has no timelock on mint/freeze/pause/burn** — `Shares`/`Recoverable`/`ERC20Allowlistable` — Code smells: single-key `onlyOwner` can instantaneously burn any holder's balance or freeze the registry; no `onlyOwner`-role separation or delay.

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Findings 1-3 are reproduced by passing Hardhat PoCs in `test/AuditPoCs.ts`; the leads above are unverified trails for manual review.
