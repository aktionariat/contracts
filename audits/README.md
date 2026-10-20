# Security review

| Date | Reviewer | Report | Covers |
|---|---|---|---|
| October 2026 | [Ge6a Audits](https://github.com/gstoyanovbg/audits) (Georgi Stoyanov) | [2026-10-ge6a-security-review.pdf](2026-10-ge6a-security-review.pdf) | Version 6 of the share tokens, the secondary market, direct investment and payment hub |

## 2026 review by Ge6a Audits

- Reviewed: commit `5c188a8` (tag `audit-2026-09`), 25 files, 1,278 lines, September 11 to 21, 2026.
- Remediation reviewed: `shares-v6` at `e86420a`, plus `bf0d125` for M-08. These commits are on `master`.
- 24 findings: 2 High, 8 Medium, 9 Low, 5 Informational. 18 fixed and verified by the reviewer, 6 acknowledged with the reviewer's agreement. The acknowledged findings (M-05, L-04, L-05, L-06, L-07, I-01) and the centralisation notes (CR-1 to CR-3) are listed as known behaviour in [SECURITY.md](../SECURITY.md).
- The code was restructured between the review and the remediation: `TradeReactor` was merged into `SecondaryMarket`, the token and pool factories were replaced by `AktionariatFactory`, and the wrapper logic moved to `Wrapping.sol`. The report's Aktionariat responses name the commits.
- Not covered by this review: `contracts/factories/`, `contracts/multisig/`, `contracts/EIP7702/`, `BridgedSharesUnderAgreement`, and the `Wrapping` module in its current form. Bugs there are in scope of the [bug bounty](../SECURITY.md).

Report security bugs to bugs@aktionariat.com, see [SECURITY.md](../SECURITY.md).
