# Signature & Replay Analysis — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Signature verification and replay analysis on in-scope contracts

## Findings

### [F-1] No signature verification in in-scope contracts

The six in-scope attack surfaces do not use signature verification (`ecrecover`, ECDSA, EIP-712, permit, meta-transactions).

**Contracts reviewed for signature usage:**
- `DeterrenceFee.sol` — no signatures
- `PaymentHub.sol` — no signatures
- `MultichainWallet.sol` — no signatures (uses CCIP for cross-chain sync)
- `ERC20Allowlistable.sol` — no signatures
- `DragAlong.sol` — no signatures
- `Modification.sol` — no signatures
- `FactorySource.sol` — no signatures
- `FactoryDestination.sol` — no signatures
- `BridgedSharesUnderAgreement.sol` — no signatures
- `CCIPAdministrable.sol` — no signatures
- `MultiSigWallet.sol` — uses `ecrecover` for transaction signing, but this is in the multisig layer, not in the in-scope contracts

**Status:** No findings. The `MultiSigWallet` does use `ecrecover` for transaction authorization, but it is not within the scope of this in-depth audit (the multisig is a separate system).

---

### Note: MultiSigWallet ecrecover usage

While not in scope, the `MultiSigWallet.verifySignatures` function at `contracts/multisig/MultiSigWallet.sol:152-168` uses raw `ecrecover` without checking for `address(0)` return. If a signer is `address(0)`, the signature would be accepted if `power[address(0)] > 0`. However, `_setSigner` at line 205 prevents setting `address(0)` as a signer, so this is mitigated by the signer management logic.
