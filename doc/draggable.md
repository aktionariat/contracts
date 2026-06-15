# Shares Under Agreement

![drag-along](https://hub.aktionariat.com/images/contracts/draggable.jpg)

Documentation for the [SharesUnderAgreement](../contracts/shares/sha/SharesUnderAgreement.sol) token, which wraps a base [Shares](../contracts/shares/base/Shares.sol) token and binds it to a shareholder agreement (SHA). It composes two modules: [DragAlong](../contracts/shares/sha/DragAlong.sol) for acquisitions (documented separately in [dragalong.md](dragalong.md)) and [Modification](../contracts/shares/sha/Modification.sol) for migrations and termination.

## Overview and Motivation

A bare share token confers ownership but says nothing about a shareholder agreement. To bind shares to an SHA, holders wrap their base tokens into a SharesUnderAgreement token. Think of this as taking a paper certificate and putting it into a sealed envelope: for each wrapped token, the contract holds exactly one base token as backing, and the wrapped token legally represents that base token bound to the agreement. The wrapper enforces the parts of the agreement that can be automated — most importantly the drag-along clause — while the tokens remain freely tradable.

## Wrapping and Unwrapping

Anyone holding base tokens can `wrap` them at any time, escrowing the base 1:1 and receiving wrapped tokens. The issuer can mint and wrap in one step via `Shares.mintAndWrap`.

Unwrapping is only possible once the agreement is no longer `binding`, which happens after a termination, migration, or executed acquisition (see below). At that point holders call `unwrap` to break the seal and receive their share of whatever the wrapper now holds — either the original base tokens, or, after an acquisition, the sales proceeds. The amount returned is computed proportionally (`convertToBase`), so the rule works the same whether the backing is one base token per wrapped token or a pool of acquisition proceeds.

## Drag-Along

The drag-along clause lets a buyer acquire all wrapped shares once the agreed conditions are met, forcing minority holders to sell at the same price. The on-chain process is veto-based: a buyer publishes a binding offer, and if neither the issuer nor any holder above 10% denies it within 20 days, anyone can execute it. Execution pays the holders, hands all shares to the buyer, and terminates the agreement. The full mechanism is documented in [dragalong.md](dragalong.md).

## Migration, Termination and Cancellation

The `Modification` module governs structural changes to the agreement. Any qualified party — the issuer, or any holder with more than 10% of the supply — can propose one, and each proposal is subject to a 20-day veto window (`MIGRATION_PROPOSAL_DELAY`) during which a qualified party can cancel it with `cancelMigration`. After the delay, anyone can `executeMigration`.

| Proposal | Who | Effect on execution |
|---|---|---|
| `proposeMigration(successor)` | issuer or >10% holder | Moves all base tokens into a successor contract (a new SHA) and terminates this one, so holders unwrap into the successor. |
| `proposeTermination()` | issuer or >10% holder | Lifts the binding without moving anything. Holders can unwrap back into the plain base token. |
| `proposeCancellation()` | issuer only | Burns the escrowed base tokens, e.g. to re-issue the underlying securities in a different form or on another chain. |
| `proposeInternalMigration()` | issuer only | Updates the base token to its own successor without terminating the agreement. |

Migrating to a new contract is how the functionality of an SHA token is upgraded: rather than making the existing token mutable, holders consent to the change by being moved (or by unwrapping and re-wrapping) into a new contract whose terms they can inspect.

## Attack Vectors

A majority of shareholders could abuse the drag-along to acquire the minority's shares at an unfairly low price by making a cheap offer and not denying it. Doing so would violate the shareholder agreement, and the minority would hold the majority accountable through the ordinary legal system. The assumption is that at least some of the majority shareholders are identifiable, so they can be taken to court or the matter settled bilaterally.

## Why no tag-along?

While a drag-along clause is straightforward to enforce in a smart contract, a tag-along clause is not. A tag-along lets a shareholder sell at the same price when others sell a large package. This is hard to automate because a token transfer does not necessarily imply a sale, and even when it does, the price and any side-agreements are not visible on-chain. Shares can even change owner without moving, for example when held by an intermediary and reassigned contractually. Enforcing a tag-along therefore requires human judgement and cannot be automated — as is the case for most contractual clauses. We are fortunate that the most important one, the drag-along, reduces to a relatively simple smart contract.

## Deterrence Fee

Making an acquisition offer requires a deterrence fee paid in the chain's native currency and forwarded to the issuer. It carries no economic upside for Aktionariat; its only purpose is to make frivolous or malicious offers costly. The issuer is exempt. The same mechanism guards the recovery proposals (see [recoverable.md](recoverable.md)).
