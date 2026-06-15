# Direct Investment

![bazaar marketplace](https://hub.aktionariat.com/images/contracts/bazaar.jpg)

Documentation for the [DirectInvestment](../contracts/investment/DirectInvestment.sol) contract, the successor of the Brokerbot.

## Purpose

The Direct Investment contract lets the issuer sell shares directly to investors at a price it controls, with the share inventory and the proceeds held by the contract. It is the on-chain equivalent of a primary issuance counter. Unlike the old Brokerbot, it only sells — it does not buy shares back. Shareholders who want to sell use the [secondary market](secondarymarket.md) instead.

## Price

The issuer sets a base `price` and a linear `increment`. The first share costs `price`, and each further share in the same purchase costs `increment` more than the previous one, so the price rises with demand. `getBuyPrice(n)` returns the total cost of the next `n` shares as the sum of this arithmetic series. The issuer can change the price at any time with `setPrice`, and open or close the counter with `setEnabled`. There is no automatic time-based drift; price changes are always explicit.

## Paying

A purchase always settles for the exact computed price. There are two ways to pay:

- **On-chain, through the [PaymentHub](../contracts/investment/PaymentHub.sol).** The hub lets an investor pay in the contract's base currency, or in any other ERC-20 token or in ETH, routing the payment through a Uniswap v3 swap into the base currency before settling. A single allowance to the hub works across all Direct Investment contracts. The hub computes the exact base amount needed and refunds any unused remainder.
- **Off-chain, settled by the issuer.** For bank transfers and other off-chain payments, the issuer calls `notifyTradeAndTransfer` (or its batch variant) to deliver the shares once the payment has been confirmed.

The contract verifies that the base currency received matches `getBuyPrice` exactly, so an investor can never be under- or over-charged for a given number of shares.

## Administration

The issuer can withdraw accumulated proceeds with `withdraw`, and move the entire inventory and balance to a successor contract with `migrate` (which also disables buying). The `PaymentHub` additionally exposes `multiPay`, a convenience method to pay many recipients in one transaction, for example to distribute a dividend.
