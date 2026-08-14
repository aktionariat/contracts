# Sumamry Report

Report summary of all agents reports and useful findings.
Agents report are found in `audits/agents` folder.
Tests to back those findings can be found at `test/audits/agents`.

## Important Issues

### `Shares.burn` auto-allowlists address(0), silently corrupting the registry's default type and blocking all future mints

```diff
- True:	Admin address turns all transfered to addresses into Admin, and if an admin burns tokens, also address(0)
-		becomes one. The question is, is it desired behaviour? At the end, if address(0) is allowed, effects are:
-			- anyone that is not restricted can burn
-			- you can no longer mint to free, only to admin or allowed
+ Solution is simple to block only address(0) from becoming admin, see below.
```

see `ERC20Allowlistable.sol`.

`ERC20Allowlistable._beforeTokenTransfer`: With an issuer configured as ADMIN (`setType(issuer, TYPE_ADMIN)`) and transfer restrictions disabled, a single holder self-burn (`Shares.burn`, which routes `_transfer(holder -> owner)` then `_burn(owner)`) flips address(0) to ALLOWED. Every subsequent `mint` to an un-allowlisted (FREE) recipient goes through `_beforeTokenTransfer(address(0), recipient, ...)`, where `isAllowed(address(0))` now reverts with `Allowlist_ReceiverNotAllowlisted(recipient)` — the company can no longer issue shares to new holders. The flag can only be cleared by an owner call to `setType`, and even then the corruption recurs on the next burn.

Fix:

- Remove the zero address from the update when sendign tokens there from an admin address.

```diff
-            if (isAdmin(from)) {
+            if (isAdmin(from) && to != address(0x0)) {
                  setFlag(to, FLAG_INDEX_ALLOWED, true);
                  emit AddressTypeUpdate(to, TYPE_ALLOWED);
              }
```

#### Plan

Fixes:

- Lookup table of non-allowable addresses (always free addresses)
- Allowed status is applied with a special transfer transerAndAllow instead of beforeTransfer and the lifecycle call only checks the table permissions without setting anything. This approach makes it easier to manage allowlistings and we discard all side effects of transfers.
- Allowed status is applied only to EOA, i.e. no contracts, not address(0), as for their functionality to e used they must be free. Since all deployed contracts start with free allowlist it does not impose any problem or additonal behaviour that was alreeady present. If a user wants to restric a specific contracts it would have to apply restriced instead of allowed. Fix applied.

### Deterrence fee is silently swallowed when the owner cannot receive ETH

```diff
- True:	If address can't receive ethers as payment txn still suceeds and fee is not delivered.
+ Solution is simple, revert if transfer bool is false.
+ "Stealing" funds after 180 days is part of the feature.
```

see `DeterrenceFee.sol`

The intended deterrent is a 0.01 ETH fee (`DeterrenceFee.sol:57-61`), but the payment is forwarded with an ignored return value — `(bool success, ) = payable(owner).call{value: fee}("")` — so if the owner cannot receive ETH (e.g. a contract without `receive()`/`fallback()`), the fee is silently dropped, enforcement is void, and the attacker's ETH is stranded instead of charged.

Fix:

- Revert if the transfer did not succeede, and add a refund if sent tokens exceede fee or send the whole amount.

```diff
-            (bool success, ) = payable(owner).call{value: fee}("");
-            emit DeterrenceFeePaid(msg.sender, fee);
+            (bool success, ) = payable(owner).call{value: fee}("");
+            if (!success) revert FeeTransferFailed(fee);
+            emit DeterrenceFeePaid(msg.sender, fee);
```

Additionally, gate `initRecovery` on an opt-in signal (e.g. the target address having registered as lost, or an on-chain proof-of-loss attestation) rather than any address, or require the proposer to stake a meaningful, forfeitable amount.

#### Plan

Applied `msg.value` fix.

### `MultichainWallet.sync` reuses `msg.value` in a loop: the wallet's own ETH pays for other chains' fees

```diff
- True: When operating the send multiple times, the contract keeps using the msg.value, that is
-		fixed to the amoutn being sent. This can lead to return to the caller more ether than sent
-		since the extra msg.value is refunded each time.
+ Solution is to return the spent value for each transaction and subtract it from a variable
+ that tracks the amount sent by the caller
```

See `multisig/MultichainWallet.sol`.

`multichain/MultichainWallet.sol`: `sync(uint64[] targets, address[] signerList, address feeToken_)` (L38) loops over `targets` and re-invokes the payable `sync(uint64, address[] memory, address)` for each chain. `msg.value` is **constant for the whole transaction**; it is never decremented. So on every loop iteration the fee guard `if (msg.value < fee) revert InsufficientNativeFeeToken(...)` (L79) is re-evaluated against the _original_ payment, and each iteration's fee is drawn from the wallet's aggregate balance (the sender's ETH + the wallet's pre-existing ETH). A caller who pays the fee for **one** chain therefore makes the wallet's own balance pay for **every subsequent** chain. The refund line `payable(msg.sender).call{value: msg.value - fee}` (L82) is also recomputed from the stale `msg.value` and can try to send back funds that are no longer in the contract (silently failing, unchecked return value). If the wallet balance runs out mid-loop, the whole sync reverts.

Code:

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

Fix:

- Compute the actual amount of fee needed within the call, and sum it each time:

```solidity
function sync(uint64[] calldata targets, address[] calldata signerList, address feeToken_) external payable {
    uint256 feesCost = 0;
    for (uint i=0; i<targets.length; i++){
        feesCost += _sync(targets[i], signerList, feeToken_, remaining);
    }

	// refund feesCost
}
```

To do so, abstract the message sending as \_sync that returns the actual fee in an internal function, and the refund logic also as another internal fucntion.
Then apply different logic computation within each call: batch and single.

This line: `uint256 fee =  IRouterClient(getRouter()).getFee(chain, message);` is the middle man between the two internal fucntions.

#### Plan

Applied abstraction of tasks and reduction of native on each call fix.

### Unprotected `initialize()` lets anyone seize ownership of the share-token family — unlimited mint, broken bridge peg

```diff
- True:	If a deployed logic contract does not call _disableInitializers within constructor, an attacker may
-		initialize the logic contract itself, it does not directly affect the proxy' storage, but it is
-		good practice to have it.
-       Attack vector could be: self destroy the logic contract after attacked becomes the owner, after
-		EIP-6780 (Shanghai) is not a viable attack vector.
+ Solution is simple, call _disableInitializers within constructor.
```

See proxies contracts: Shares, SHA, BridgedSHA, LockRelease and BurnMint TokenPools.

`shares/base/Shares.sol` L98-104 · `shares/sha/SharesUnderAgreement.sol` L99-109 · `multichain/BridgedSharesUnderAgreement.sol`: `Shares`, `SharesUnderAgreement` and `BridgedSharesUnderAgreement` all expose `initialize(...) public initializer` as a "proxy constructor", but none of the constructors call `_disableInitializers()` (or otherwise consume the initializer). After deployment the OZ `initializer` guard is still unset, so **anyone** can call `initialize` on the live contract and become `owner`. Because `initialize` re-runs `__Ownable_init(_owner)` (and for SHA/bridged tokens also re-sets `base`/`terms`), the attacker overwrites the issuer's owner slot. `_disableInitializers()` is absent from the entire codebase.

Fix:

- Call `_disableInitializers` at the end of the constructor of logic proxied contracts

#### Plan

Applied `_disableInitializers` fix.

## Middle Ground Issues

### Filler-controlled `totalFee` lets anyone pocket 100% of a seller's proceeds

```diff
- TradeReactor.process
- Valid Concern:    If intent are signed and sent to a malicious actor, it could drain the seller's
-                   tokenIn balance.
-					Those trades are usually run by a benevolent actor (backend).
+ Solution:	Cap fees that can be collected. Could be capped to: transaction fee plus a maximum percentage.
+			Or, since tokenIn is usually frankencoin, to a maximum percentage amount of the deller's balance.
```

See `TradeReactor.sol`.

`TradeReactor.process`: A filler with both signed intents calls `process(seller, sig, buyer, sig, tradedTokens, totalExecutionPrice)` as `msg.sender`. The buyer pays full price, the seller receives `0`, the filler receives the whole trade value. A fair filler would set `totalFee` to a negotiated rate; nothing enforces that choice. Malicious front-runners can also grab publicly-signaled intents and force the max fee.

Fix:

- Derive `totalFee` inside `process` from a stored fee schedule (like `SecondaryMarket`'s `tradingFeeBips`) rather than trusting the caller (maybe also re-emit the `Trade` event with the actual fee)
- Place a fixed cap that the caller can't exceede.

```diff
- function process(Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig, uint256 tradedTokens, uint256 totalFee) public {
+ // totalFee must be derived on-chain, e.g. from a fee registry, or capped against the intent:
+ // if (totalFee > totalExecutionPrice * MAX_FEE_BIPS / 10000) revert FeeTooHigh();
```

#### Plan

Not of systematic concern.
We defer the problem to be managed benevolently by the router.

## Not Important Issues

### `SecondaryMarket.process`: seller's signed minimum `amountIn` is never enforced

See `contracts/market/SecondaryMarket.sol:254-262`, `contracts/market/TradeReactor.sol:137-138`

```solidity
// SecondaryMarket.sol:258-259
uint256 totalExecutionPrice = IReactor(REACTOR).getTotalExecutionPrice(buyer, seller, tradedAmount);
uint256 totalFee = totalExecutionPrice * tradingFeeBips / 10000;

// TradeReactor.sol:137-138
IERC20(sellerIntent.tokenIn).safeTransfer(sellerIntent.owner, totalExecutionPrice - totalFee); // net proceeds to seller
IERC20(sellerIntent.tokenIn).safeTransfer(msg.sender, totalFee); // fee to filler
```

**The fee is applied at execution time, not signing time.** `setTradingFee` (`SecondaryMarket.sol:104-107`) lets the owner raise the fee to 5% at any moment; every order signed and resting in the book is instantly re-priced below its signed floor without the seller's consent. The intent carries no fee term, so the seller's signature covers the pre-fee amount only.

Also if a user signs two intents, both can be executed.

#### Plan

We defer any off chain invariants to be managed benevolently by the router.

### `SecondaryMarket.process` clears off-pair trades that `validateOrder` rejects

See `market/SecondaryMarket.sol`

`validateOrder`/`executableAmount` enforce that an intent trades the market's configured pair — `(tokenOut == TOKEN && tokenIn == CURRENCY) || (tokenOut == CURRENCY && tokenIn == TOKEN)` — reverting with `WrongTokens()` otherwise (`SecondaryMarket.sol:161`). `process` (`SecondaryMarket.sol:254`) performs **no** pair check. It only relies on the reactor's cross-intent `TokenMismatch` checks (`TradeReactor.sol:121-122`), which hold for _any_ pair where `seller.tokenOut == buyer.tokenIn` and `seller.tokenIn == buyer.tokenOut`. Because `router` defaults to `address(0)` ("null for any", `SecondaryMarket.sol:53`), **any** caller can invoke `process` and clear off-pair intents through the issuer's market venue, where `validateOrder` reports them as invalid.

Fix:

- enforce the pair in `process` exactly as `validateOrder` does:

```diff
  function process(Intent calldata seller, bytes calldata sellerSig, Intent calldata buyer, bytes calldata buyerSig, uint256 tradedAmount) external {
      if (!isOpen) revert MarketClosed();
      if (router != address(0) && msg.sender != router) revert WrongRouter(msg.sender, router);
+     if (!((seller.tokenOut == TOKEN && seller.tokenIn == CURRENCY) ||
+           (seller.tokenOut == CURRENCY && seller.tokenIn == TOKEN))) revert WrongTokens();
+     if (!((buyer.tokenOut == TOKEN && buyer.tokenIn == CURRENCY) ||
+           (buyer.tokenOut == CURRENCY && buyer.tokenIn == TOKEN))) revert WrongTokens();

      uint256 totalExecutionPrice = IReactor(REACTOR).getTotalExecutionPrice(buyer, seller, tradedAmount);
```

#### Plan

We fixed the issue by adding a `verifyTokenAndCurrency` before trades happen.

### `Modification._propose` silently overwrites a pending migration

```diff
- It is true: proposal overrides another one without checking first if it is expired or not
+ Solution: Check that the proposal expired or that it has been canceled before overriding
+ Proposed fixes:
+	- revert in _propose when migration.timestamp != 0 (mirroring OfferPending), forcing an explicit cancelMigration() first.
```

See `shares/sha/Modification.sol`.

shares/sha/Modification.sol:74-83` (`proposeMigration`/`\_propose`): `\_propose`requires only that`msg.sender` be qualified (`isQualified`= the owner **or any holder with`> totalSupply()/10`**, `Modification.sol:125-127`) and then **unconditionally overwrites** the `migration` slot (`Modification.sol:80`). There is no "a migration is already pending" guard — in contrast to `DragAlong.offerAcquisition`, which reverts with `OfferPending`while an offer is live. A qualified holder can therefore silently replace any pending migration — including an issuer-proposed`proposeTermination()`— with their own`proposeMigration(successor)`, with no veto window and no overwrite-specific notice.

Fix:

- Revert if a migration message is there, enforce to call `cancelMigration` first.

```diff
  function _propose(IERC20 successor, uint8 migrationType) internal returns (Migration memory) {
      if (!isQualified(msg.sender)) revert NotQualified();
+     if (migration.timestamp != 0) revert MigrationPending();
      migration = Migration({ successor: successor, timestamp: uint64(block.timestamp), migrationType: migrationType });
      emit MigrationProposed(msg.sender, successor, migrationType);
      return migration;
  }
```

(Maybe also emit a dedicated overwrite event)

#### Plan

We allow overriding.

### Recovery

On source chain people can call recovery for any contract: including the token pool, and a SHA which holds all shares that have been wrapped.
Maybe to reduce efforts on monitoring could be good t have a blacklist of addresses which recovery is disallowed.
For example the lock release token pool could be a blacklisted address.

See `Recoverable.sol`

Fix:

- Add blacklist mapping of address to bools and enforce blacklist on key address (especiall contracts) that hold tokens: TokenPool, SHA
- Monitoring

#### Plan

We monitor it.

### MultichainWallet: out-of-order signer syncs resurrect removed signers

Do we really wnt to have out of sync messages? Problem is: desstinations could get out of sync if multiple messages are sent.

Fix:

- (Basically bridge a piece of information that can track messages order, revert if older message is received) Add a monotonically increasing sync sequence (mainnet keeps lastSyncSeq; only messages with a strictly newer sequence are applied, and the sequence is included in the CCIP payload). Alternatively make ccipReceive a snapshot-based set replace keyed by a mainnet-maintained version number, and ignore stale versions.

#### Plan

We allow it.

### AuthorizedExecutor: AuthorizedCall has no deadline

Calls maybe need a deadline field to prevent authorized transaction from being executed even after a long time.
Is it something to be considered?

Also the addition of a revocation function for the signature? (How could it be done?)

#### Plan

We defer the issue to clients that create and manage signature calls.
That is, to market contracts.
There we find a cancelIntent, which supposes the router will behave correctly and discard the intent.

### TradeReactor intents: no nonce; stale intent live for the whole window; cancelIntent is a race

Add a nonce to trade reactor's Intents to silently discard previously signed intent.
Proposed fixes are:

- Add a per-owner (or per-owner/per-token) monotonically increasing nonce to the signed Intent, and reject fills of intents whose nonce is behind the owner's current one. Signing intent B then implicitly invalidates intent A.
- At minimum, keep creation in the price path but document that getTotalExecutionPrice (TradeReactor.sol:100-104) trusts the signer-chosen creation ordering.

#### Plan

We allow it, router is considered a benevolent actor.

### DragAlong proposal

Anyone can submit an offer startign from a price per shares of 0, and with a base token that is worthless.

Fixes:

- Minimum price bound (pricePerShareE18 > 0, ideally a market-realistic floor)
- Currency sanity (reject self-mintable/unknown ERC20s, or require the currency to be a known/allowlisted feed-backed asset)
- Problem is also resolved by monitoring

#### Plan

We monitor it.

### SecondaryMarket.withdrawFees, MultichainWallet.sync

No check that tokens have been transfered correctly.

See `SecondaryMarket.withdrawFees` and `MultichainWallet.sync`
