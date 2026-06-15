# Drag-Along Mechanism 2.0

![drag-along](https://hub.aktionariat.com/images/contracts/draggable.jpg)

## Overview and Motivation

Typical shareholder agreements contain “drag-along” and “tag-along” clauses. If someone makes an acquisition offer and a majority of shareholders wants to sell, the drag-along clause allows them to force the rest of the shareholders to join them in selling their shares at the same price. This is useful because an acquirer often wants to either buy a company completely or not at all. This is similar to a squeeze-out on the stock market, which allows someone owning 98% of a company to buy the remaining 2%. In contrast, a drag-along clause is often already enforceable when 51% or so of the shareholders agree. However, enforcing a drag-along clause can be time consuming in practice as all involved parties need to be contacted, need to sign a transfer agreement, and need to be paid. Our draggable smart contract fully automates this process for tokenized shares, thereby allowing companies to have thousands of shareholders without losing the strategic option of an exit.

## Drag-Along Process

This section describes the automatic enforcement of the drag-along clause implemented by the [DragAlong smart contract](../contracts/shares/sha/DragAlong.sol).

The on-chain process is veto-based rather than vote-based. A buyer publishes a binding offer, which sits open for 20 days. During that window, the issuer or any holder with more than 10% of the supply can deny the offer. If no one denies it, anyone can execute it: the buyer pays the agreed price and receives all underlying shares, and the wrapper contract switches its base from the share token to the currency the buyer paid in, so token holders can unwrap to collect their proceeds.

### Initiation

Any address can open an offer by calling `offerAcquisition(currency, pricePerShareE18, message)`. The call requires a deterrence fee paid in the chain's native currency (forwarded to the issuer) so that frivolous offers carry a real cost; the issuer themselves is exempt. Only one offer can be active at a time — a second call reverts with `OfferPending` until the existing offer is cancelled or executed.

The offer specifies:

- `currency` — the ERC-20 token in which the buyer will pay (typically a stablecoin)
- `pricePerShareE18` — currency units paid per wrapped unit, scaled by 10¹⁸ so fractional prices can be expressed exactly
- `message` — a free-form description, for example a link to terms or a press release

The total price is **not** fixed at proposal time. It is computed at execution as `pricePerShareE18 * totalSupply() / 10**18`, using the supply at the moment of execution. This means that if new shares are tokenized during the 20-day delay, the buyer pays proportionally more so per-share proceeds are not diluted for existing holders. The buyer must therefore pre-approve enough of the currency on the contract to cover the worst-case total they are willing to pay.

The proposal emits `OfferMade` and starts a 20-day delay (`DRAG_PROPOSAL_DELAY`).

### Execution

After the delay has elapsed and the offer has not been cancelled, anyone can call `acceptOffer()`. The function, in order:

1. Pulls the total price of the buyer's currency into the wrapper contract via `transferFrom`.
2. Transfers the wrapper's entire balance of the underlying share token to the buyer, so the buyer ends up holding all of the tokenized shares.
3. Replaces the wrapper's base token with the currency that was paid. The wrapped tokens now represent claims on the deposited proceeds rather than on the underlying shares.
4. Terminates the contract. Holders can no longer wrap new tokens or invoke other SHA-bound actions, but they can unwrap their existing tokens to receive their share of the proceeds in the new base currency.

`OfferAccepted` is emitted with the executed amounts.

`acceptOffer()` is permissionless. The contract does not check whether the legal preconditions (typically a supermajority vote per the shareholder agreement) have been met; that responsibility lies with the caller. `checkExecution()` is exposed as a view function so callers can verify the timing precondition without sending a transaction.

### Cancellation

While an offer is pending, `cancelOffer(message)` clears it. The call is permitted for:

- the contract owner (typically the issuer),
- any holder with more than 10% of the total supply,
- the buyer themselves, allowing them to withdraw their own offer.

`canCancelOffer(holder)` exposes the same predicate as a view function. A successful cancellation deletes the offer, emits `OfferDenied`, and frees the slot so a fresh offer can be made.

There is no hard cutoff between the delay expiring and execution: even after the 20 days are up, a qualifying party can still cancel — until someone actually calls `acceptOffer()`, the offer remains revocable.

## Relation to Shareholder Agreement

The drag-along process is a tool that can be used to enforce a drag-along clause as defined in a shareholder agreement that is referred to by the SharesUnderAgreement token. It is the responsibility of the participating parties to ensure that the functionality of this contract is used in compliance with the law and applicable contracts. The fact that the drag-along technically can be executed does not automatically imply that it is also legally and contractually permissible to execute or cancel it. What is permissible or not is not defined in the technical smart contract, but in the accompanying shareholder agreement.
