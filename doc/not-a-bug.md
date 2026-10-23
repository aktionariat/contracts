# Not a bug

Behaviour of the contracts on `master` that looks like a bug and is not. Each entry says what a reporter sees and why it is accepted. Behaviour described in the other files of this directory is not a bug either; it is the design. A report about anything in this file or those is discarded without reply. See [SECURITY.md](../SECURITY.md) for the bug bounty.

## Acknowledged in the 2026 security review

- **M-05 One market per allowlist regime.** A `SecondaryMarket` cannot serve free-float and allowlisted holders at once. A company that runs both deploys two markets. `allowlist.md`
- **L-04 Bank orders reserve no inventory.** On-chain buyers can empty `DirectInvestment` before a bank order settles. The issuer tops up and delivers again; nobody loses funds. `market.md`
- **L-05 The fee is not in the signed intent.** The trading fee can change between signing and settlement. It is bound to one market and capped at 5% by the contract. `secondarymarket.md`
- **L-06 The recovery fee is taken up front.** `initRecovery` charges the deterrence fee without checking whether the recovery will be executable after 184 days. The fee exists to deter claims; the claimant chooses to pay it. `recoverable.md`
- **L-07 No on-chain veto while a recovery is pending.** A holder who cannot act on-chain has no veto over a drag-along or migration. They object through the issuer, who can cancel at any time and is accountable for what it lets through. `draggable.md`
- **I-01 `DirectInvestment` accepts zero addresses.** The factory rejects them, the constructor does not. `Ownable` takes the zero address on purpose: `transferOwnership(address(0))` renounces ownership.
- **CR-1 to CR-3 Issuer centralisation.** Uncapped issuance can dilute the 10% veto, freeze, pause and market closure have no expiry, and the issuer sets the deterrence fees it is itself exempt from. The issuer is trusted under the trust model.

## Rejected reports

Reports we received and rejected, with the reason. A new report that fails for one of these reasons is rejected the same way, whether or not its exact scenario is listed.

The reasons:

- **Not noticed.** The attack works only if Aktionariat or the issuer fails to notice an on-chain state they check as part of their process: a squatted address, a pending offer or proposal, a changed signer set.
- **Against procedure.** The attack needs Aktionariat to deploy or configure contracts in an order or a way its deployment procedure rules out.
- **Recoverable.** The resulting state is undone with the ordinary powers of the issuer or Aktionariat. Nothing is lost or locked.
- **No gain.** The attacker pays fees, gas or capital and ends up with nothing.
- **Bad dependency.** The attack needs a payment token, CCIP or another external dependency to misbehave, or a trusted party to accept a malicious one.
- **Issuer configuration.** The attack needs a setup the issuer chose knowingly, such as a market without a router.

The reports:

- **Multisig factory salt squatting.** Anyone can create a wallet for a salt first, with their own signers. *Not noticed*: Aktionariat sees at deployment that the address is already set up and uses another salt. Nothing is sent to an address before its wallet exists.
- **Remote wallet trusts its Ethereum address.** A wallet on another chain accepts signers from whoever holds its address on Ethereum. *Against procedure*: the Ethereum wallet is always created first. *Not noticed*: a hijacked Ethereum address is seen before anything is deployed against it.
- **Stale CCIP sync restores a revoked signer.** A sync message executed late can set a signer power the Ethereum wallet has since changed. *Not noticed* and *recoverable*: the issuer sees the signer set and syncs again. *No gain*: the attacker pays for a message that is overwritten.
- **Zero-price drag-along offer.** `offerAcquisition` accepts any price, including zero. *Not noticed*: the offer is public for 20 days and the issuer or any holder above 10% cancels it. *No gain*: the offeror loses the deterrence fee on every attempt.
- **Fee-on-transfer offer currency.** A currency that delivers less than requested settles the buyout short. *Bad dependency*: the issuer and holders accept the currency when they let the offer stand, and cancel an offer in a malicious one.
- **Migrations on a terminated wrapper.** A migration or cancellation proposed after termination, or left standing through one, would move or burn the proceeds. *Not noticed*: every proposal is public for 20 days and the issuer cancels it.
- **Dust fills accumulate rounding.** Splitting a match into many tiny fills rounds each by up to one currency unit against the later intent. *Issuer configuration*: needs a market without a router, since the router decides how a match is split. The holder's allowance caps the exposure.
