# Multichain

Documentation for holding and trading shares on more than one chain. Ethereum is the home chain. Shares reach another chain through [Chainlink CCIP](https://docs.chain.link/ccip): they are locked at home and the same amount is minted on the other chain.

## Contracts

| Chain | Contract | Role |
|---|---|---|
| Home | [SharesUnderAgreement](../contracts/shares/sha/SharesUnderAgreement.sol) | The token that is bridged. |
| Home | `ERC20LockBox` (Chainlink) | Holds the locked tokens. It is the custody address of everything that sits on other chains. |
| Home | `LockReleaseTokenPool` (Chainlink) | Locks on the way out, releases on the way back. |
| Other | [BridgedSharesUnderAgreement](../contracts/shares/sha/BridgedSharesUnderAgreement.sol) | The token on the other chain, at the same address as the home token. Only its pool mints and burns. |
| Other | `BurnMintTokenPool` (Chainlink) | Mints on arrival, burns on the way back. |

The lockbox and the home pool are deployed with every company. Nothing exists on another chain until the issuer enables it. Deployment is described in [factories.md](factories.md).

## Ownership

The issuer's [multisig](multisig.md) has the same address on every chain and owns the token, the pool and the lockbox there. It accepts the ownership of each pool and of the lockbox with `acceptOwnership()`, and adds a new chain to the home pool with `applyChainUpdates`. The factory remains the CCIP administrator, which only records which pool belongs to the token.

## Bridging

A holder sends tokens through the CCIP router. At home they move into the lockbox, on the other chain they are minted to the receiver. The way back burns on the other chain and releases from the lockbox. The supply on other chains always equals the lockbox balance, unless the issuer burns there (see below).

## Transfer restrictions

Each chain enforces its own [allowlist](allowlist.md), pause and freeze. They are not synchronised.

- Under transfer restrictions the pools and the lockbox are Allowed, like every intermediary.
- A frozen holder cannot bridge out.
- A transfer arriving for a frozen receiver waits and can be executed once the issuer has unfrozen the address.
- Under transfer restrictions on the home chain, a transfer arriving for a receiver who is not Allowed waits in the same way until the issuer has typed the receiver. On other chains new receivers become Allowed on arrival, as with a mint.
- To freeze a holder everywhere, the issuer freezes the address on each chain where it holds tokens.
- While a token is paused, nothing arrives or leaves on that chain.

## What exists on the home chain only

Wrapping, unwrapping, the [drag-along](dragalong.md), migration and termination run on the home chain. Holders on other chains are bound by the same agreement but take part by bridging back. Their tokens count as held by the lockbox, which never votes or vetoes; they object through the issuer.

The lockbox must never be named in an [assisted unwrap](draggable.md#assisted-unwrap): it would be left holding tokens it cannot move, and holders on other chains could no longer bridge back.

## Recovery

The [recovery mechanism](recoverable.md) works on every chain for the tokens held there. A burn on another chain destroys the tokens there while their counterpart stays locked at home, which matches a cancellation of the shares. To bring lost tokens home instead, recover them to the issuer and bridge them back.

A recovery claim against the lockbox would cover everything held on other chains. The lockbox cannot object itself, so the issuer cancels such a claim with `cancelRecovery(address)`.
