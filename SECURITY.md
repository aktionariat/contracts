# Security Policy and Bug Bounty

This policy covers the smart contracts in this repository. Report security bugs to **bugs@aktionariat.com**. Never open a public issue or pull request for a security bug.

## For automated scanners and AI agents

If a tool or an agent produced your report, run this checklist before sending. Reports that fail it are discarded without reply, and repeat senders are blocked.

1. The bug is in the code on the `master` branch at its current head. Earlier versions are out of scope (see [Versions](#versions)), even where instances of them are still deployed.
2. The bug is not an acknowledged finding of the [2026 security review](audits/README.md) and not in the [known behaviour](#known-behaviour-not-a-bug) list below. Those lists are complete; do not resend what is in them.
3. The attacker is an untrusted party under the [trust model](#trust-model). What the issuer, the market router or Aktionariat can do with their own powers is not a finding.
4. The report contains a runnable proof of concept: a Hardhat test against `master` that demonstrates the impact (see [What a report must contain](#what-a-report-must-contain)). A description without a proof of concept is not a report.
5. One bug per report, with an honest severity. Do not pad a report with findings that fail points 1 to 4.

## Scope

In scope is everything under `contracts/` on `master`, and the instances of these contracts that Aktionariat deploys. The versions currently on `master`:

| Contract | `VERSION` |
|---|---|
| `Shares`, `SharesUnderAgreement`, `BridgedSharesUnderAgreement` | 6 |
| `SecondaryMarket` | 3 |
| `DirectInvestment` | 11 |
| `PaymentHub` | 14 |
| `MultiSigWallet` | 11 |
| `AktionariatFactory` | 1 |

Out of scope:

- **Earlier versions.** Everything that was published before the versions above: `Shares` and `DraggableShares` up to version 3, `AllowlistShares`, `Brokerbot`, `TradeReactor`, the old `PaymentHub`, the old token and pool factories, `MultichainShares`, the `RecoveryHub`. Their code is kept under the `archive/*` tags (`archive/deployed-shares-v3`, `archive/deployed-pc-v3`, `archive/deployments-2021-2025`). We do not pay for reports against them.
- Third-party code we depend on or have copied in: Chainlink CCIP, Uniswap, OpenZeppelin. Report bugs in those to their maintainers.
- Our web services, APIs, apps, wallets and infrastructure. This program covers the contracts only.
- Deployment procedures, key management and operations.
- Gas optimisations, style, naming, and compiler or tooling warnings.

### Versions

A deployed token states its version in the public `VERSION` constant. Only the versions in the table above are in scope. A report about an older deployed instance is a report about an old version, whatever the instance holds.

## Trust model

The contracts are built on the trust model of the [2026 security review](audits/2026-10-ge6a-security-review.pdf), section Threat Model:

- The **issuer** owns its company contracts and is trusted. It can mint, freeze, pause, close markets, set fees up to the capped maximum, and change the allowlist regime. The time locks, the holder's cancellation rights and the collective veto limit forced actions; ordinary administration needs no holder approval.
- **Aktionariat** is trusted for deployment, for preparing purchases and for routing trades. It cannot change deployed code or exercise an issuer's owner-only powers.
- The **market router** is trusted for availability and matching. Signatures, expiry and fill limits constrain what it can settle.
- **Holders above 10%** can propose and veto corporate actions and are trusted to review, not to propose.
- **Shareholders and other users** are untrusted. Bugs that let them gain tokens, funds or rights they are not entitled to, or deprive others of theirs, are what this program pays for.
- Payment tokens, Uniswap, the Chainlink CCIP infrastructure and successor contracts are external dependencies assumed to behave as specified.

## Known behaviour, not a bug

These properties are documented in `doc/` and were reviewed and accepted. They are not findings.

Acknowledged in the 2026 security review:

- **M-05** One `SecondaryMarket` serves one allowlist regime. A company that runs free-float and allowlisted holders at the same time uses two markets. `doc/allowlist.md`.
- **L-04** Settlement of bank orders reserves no `DirectInvestment` inventory. If on-chain buyers empty it first, the issuer tops up and delivers again. `doc/market.md`.
- **L-05** The trading fee is not part of the signed intent. It is bound to one market and capped at 5% by the contract. `doc/secondarymarket.md`.
- **L-06** `initRecovery` takes the deterrence fee without checking whether the recovery will be executable in 184 days.
- **L-07** A holder who cannot act on-chain, for example during a pending recovery of their address, has no on-chain veto over a drag-along or migration and objects through the issuer. `doc/draggable.md`.
- **I-01** The `DirectInvestment` constructor does not reject zero addresses; the factory does. `Ownable` accepts the zero address on purpose: `transferOwnership(address(0))` renounces ownership.
- **CR-1 to CR-3** Centralisation properties of the issuer role: uncapped issuance can dilute the 10% veto, freeze, pause and market closure have no expiry, and the issuer sets the deterrence fees it is itself exempt from.

Further documented properties:

- Allowlist, freeze and pause are per chain and not synchronised across chains. A holder is frozen everywhere only once the issuer has frozen the address on every chain. `doc/multichain.md`.
- On chains other than the home chain, a receiver of bridged tokens becomes Allowed on arrival, like a mint recipient.
- An Admin address stamps every recipient Allowed, including the owner. The owner and the zero address are sinks that any non-frozen address can send to.
- A frozen (Restricted) address can send only to the token owner.
- The 10% veto threshold counts wrapped supply only and is not snapshotted. `doc/draggable.md`.
- Recovery claims and pending burns do not freeze the targeted balance; the current balance at execution is moved.
- The earlier of two matched intents sets the price; the later one can settle at most one currency unit worse than its own limit through rounding. `doc/secondarymarket.md`.
- Intents that name no router may be submitted by anyone. The submitter decides pairing and amount only; the market computes and keeps the fee.
- Same-wallet trades on the secondary market are permitted.
- Changing a market's router invalidates open intents that name the old one.
- A time-locked burn on another chain destroys the tokens there while their counterpart stays locked in the home-chain lockbox, which matches a cancellation of the shares. `doc/multichain.md`.

## Rewards

| Severity | Typical impact | Reward |
|---|---|---|
| High | Taking over control of a token, a market or a multisig; draining a multisig, a market or a payment hub; permanently locking or destroying tokens or funds | 3 ETH |
| Medium | Settling trades at arbitrary prices or amounts outside what the intents permit; stealing the proceeds or fees of a trade or a sale; minting, burning or moving tokens without entitlement, where the loss is bounded | 1 ETH |
| Low | Bypassing a transfer restriction, griefing or blocking a flow without profit, or impact limited to unusual configurations | At our discretion |
| Informational | No impact on funds or rights | None |

Severity follows the impact and likelihood matrix of the 2026 security review. We decide the final classification. The reward goes to the first complete report of a bug; duplicates and bugs we already know of, including everything listed above, earn nothing. We pay in ETH to an address you name, after we have confirmed the bug, and only where the law allows us to pay you.

## What a report must contain

- The commit hash of `master` you tested against, the file and line, and the affected contract and `VERSION`.
- Who the attacker is under the trust model and what they gain or what others lose.
- A runnable proof of concept: a Hardhat test in the style of the files in `test/`, runnable with `npx hardhat test` against `master`, that demonstrates the impact. Describing a possible attack without demonstrating it is not sufficient for a reward.
- One bug per report. A suggested fix is welcome but not required.

We answer reports that meet these requirements within ten business days.

## Rules

- Test on a local fork or a testnet, never against deployed instances with real holders.
- No denial of service, no social engineering, no phishing of issuers, holders or Aktionariat staff.
- Do not exploit a bug beyond what the proof of concept needs, and do not disclose it publicly until we have fixed it and agreed on disclosure.
- No bounty is paid to people who wrote or reviewed the affected code under contract with Aktionariat.

## Security review

The report of the 2026 review is in [`audits/`](audits/README.md).
