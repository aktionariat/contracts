# Allowlist

## Overview and Motivation

Small companies often have statutory transfer restrictions in place. As they grow, they typically tend to get rid of these restrictions and abandon them entirely once they are publicly traded. This allowlist implementation is designed to flexibly and efficiently accompany the company on this journey. It is possible to have freely transferrable tokens and tokens that are subject to the allowlisting in parallel, thereby supporting an incremental path from a completely controlled state to freely transferrable token with a gradually increasing free float. If necessary, the process also can be reverted again.

## Address Types

Generally, there are four types of addresses:

- "Allowed" addresses that can receive tokens from anyone, but only send to allowlisted or admin addresses.
- "Admin" addresses are like Allowed addresses, but implicitly turn target addresses into Allowed addresses, such that they can de facto transfer to anyone. If newly minted tokens need to be transfer restricted by default, the null address can be set set as "Admin", converting all new recipients to "Allowed" status during minting automatically.
- "Restricted" addresses cannot send tokens to or receive tokens from anyone, except that they can transfer tokens to the contract owner. This is the "frozen" state in CMTA terms, set with `freeze` and cleared with `unfreeze`.
- "Free" addresses that can send to Free, Allowed, and Admin addresses, but can only receive from other Free addresses. This is the default for new addresses.

Below is a summary table of the implemented ruleset. Rows represent the "from", columns represent the "to" address.

|            | Fre | Alw | Res | Adm |
|------------|-----|-----|-----|-----|
| Free       |  Y  |  Y  |  N  |  Y  |
| Allowed    |  N  |  Y  |  N  |  Y  |
| Restricted |  N  |  N  |  N  |  N (*) |
| Admin      |  Y  |  Y  |  N  |  Y  |

(*) A Restricted address can send to the contract owner, whatever the owner's own type is. This lets the issuer retrieve blocked tokens with the holder's cooperation.

## Sinks

The contract owner and the zero address are sinks: every address that is not Restricted can send to them, whatever its own type and whatever the sink's type is. Tokens sent there either leave circulation (a burn) or return to the issuer, so the transfer restrictions have nothing left to protect. This is what keeps the built-in flows working under every allowlist configuration:

- The holder's `burn` moves the tokens to the owner and burns them there.
- The issuer's time-locked `burn` in `Recoverable` does the same for a lost address, which is also how a Restricted address gets burned: it may only send to the owner.
- `unwrap` in `SharesUnderAgreement` burns wrapped tokens.
- `migrate` moves the tokens to the successor token and burns them there. The successor is not a sink, so under transfer restrictions the issuer types it Admin or Allowed when setting it.

Only the pause and the Restricted rules apply to moves into a sink. Sending to the owner does not change the owner's type, but an Admin sending to the owner still marks the owner Allowed like any other recipient. The issuer sets its own type explicitly if it wants to be able to sell to Free addresses.

## Intermediaries

Contracts that hold tokens on behalf of others must be typed Admin so that they can forward tokens to any recipient and the recipient becomes Allowed on the way. This applies to the `SharesUnderAgreement` wrapper (holds the base shares), the `TradeReactor` (holds sold tokens for a moment during settlement) and the CCIP token pools (hold locked tokens while they are bridged). Being Admin does not let them receive from a Restricted address, so a blocked holder cannot wrap, sell or bridge tokens to get around the block. Recovery of a Restricted address with `initRecovery` / `recover` must therefore name the owner as recipient, or the address must be unfrozen first.

## Token Types

The token type is not stored anywhere but implied by the address they reside on. So a free float token becomes a restricted token if sent to an Allowed address.

## Limited Free Float

The use-case of having a limited free float is somewhat extraordinary and of special interest. Starting with all shares being restricted, a company could start setting some selected addresses to the 'Free' type, thereby making the tokens on these addresses freely transferrable (at least until they are transferred to an allowlisted address again). For example, a company could declare all its treasury shares free float and then start selling them while keeping transfer restrictions for the existing shareholders in place.

## Usage

- The contracts has no default constructor. Therefore, the 0x0 address is by default "Free" and all mints also become freely transferable.
- If the tokens should be only on Allowed addresses by default, the 0x0 address needs to be converted to an Admin address, thereby automatically converting recipients to Allowed
- If the 0x0 address is given Admin status, while there are already "free float" tokens in circulations, those will not automatically be transfer restricted. It is up to the issuer to choose and convert existing holders to Allowed, thereby making them subject to transfer restrictions.
- To make tokens freely transferable by default again, simply remove the Admin status from the 0x0 address.
- Additional addresses, such as the issuer multisig, can be made Admin to also distribute shares with transfer restrictions.
- "Restricted" should be used for entirely blocked tokens, such as in cases of theft or loss.

All type changes go through `setType(account, type)` (with an array overload for batches). For the common case of blocking and unblocking a single holder, there are the convenience methods `freeze(account)` (sets it to Restricted) and `unfreeze(account)` (restores the default type), matching the CMTA freeze/unfreeze naming.

## Pause

Independently of the per-address types, the issuer can `pause()` the whole token. While paused, every transfer reverts — including mints, burns, recoveries and migrations — until `unpause()` is called. This is a global on/off switch held in a single settings flag and is meant for emergencies, not for day-to-day transfer control, which is what the allowlist is for.
