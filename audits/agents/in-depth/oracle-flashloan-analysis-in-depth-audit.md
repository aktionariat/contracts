# Oracle & Flash Loan Analysis — In-Depth Audit

- **Target:** `msg.value` usages, Allowlisting (ERC20Allowlistable.sol), zero transfers, DragAlong.sol, Modification.sol, cross-chain contracts
- **Date:** 2026-08-19
- **Method:** Oracle dependency and flash loan attack surface analysis on in-scope contracts

## Findings

### [F-1] No oracle dependencies in in-scope contracts

The six in-scope attack surfaces (`msg.value` usages, Allowlisting, zero transfers, DragAlong, Modification, cross-chain contracts) do not use price oracles, TWAP feeds, Chainlink price data, or AMM spot prices for any critical logic.

**Contracts reviewed:**
- `DeterrenceFee.sol` — no price dependency
- `PaymentHub.sol` — uses Uniswap V3 quoter for swap routing, but price is determined by the pool (not an oracle)
- `MultichainWallet.sol` — no price dependency
- `ERC20Allowlistable.sol` — no price dependency
- `DragAlong.sol` — user-specified `pricePerShareE18`, not an oracle
- `Modification.sol` — no price dependency
- `FactorySource.sol`, `FactoryDestination.sol` — no price dependency
- `BridgedSharesUnderAgreement.sol` — no price dependency

**Status:** No findings. The Uniswap V3 quoter in `PaymentHub` is a quote, not a price oracle — it returns the expected output for a given path, which is what the user specifies. This is not manipulable via flash loans in the same way a price oracle is.

### [F-2] PaymentHub Uniswap V3 quote is susceptible to sandwich attacks

**Severity:** LOW
**Location:** `contracts/investment/PaymentHub.sol:83,104,119`

`getPriceInPaymentCurrency` and the `exactOutput` swap in `swapToBaseCurrencyAndPay` are susceptible to sandwich attacks. An MEV bot can:
1. Front-run the swap with a large trade to move the price
2. Let the user's swap execute at a worse price
3. Back-run to capture the profit

The `amountInMaximum` parameter limits the maximum input, but the actual execution price could be worse than quoted. The `deadline: block.timestamp` means the swap must execute in the same block, limiting the sandwich window.

**Status:** Low — standard DEX interaction risk, mitigated by `amountInMaximum` and same-block execution.
