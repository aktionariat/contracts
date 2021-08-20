# Brokerbot

![bazaar marketplace](https://aktionariat.com/images/bazaar.jpg)

Documentation for the Brokerbot smart contract implemented in [Brokerbot.sol](../src/Brokerbot.sol).

## Purpose

The Brokerbot provides mechanisms for the selling and repurchasing of shares with automated price adjustments. The liquidity pool is note shares and provided by a single operator, usually the issuer itself.

## Price Adjustment

While the operator is free to close the market or to set the price at any time, it is recommended to refrain from doing so too often and to instead rely on the more transparent and automated price adjustment mechanisms.

There are two freely configurable price adjustment rules:

* A linear price increment per share traded
* Time based automatic drift

The increment per traded share allows the Brokerbot to respond to supply and demand, symmetrically increasing the price as shares are sold to investors and decreasing it again as they are bought back from shareholders.

The time based drift can be used to reflect expected organic growth or to have implicit pay-outs. For example, a company that has no growth but makes 100k CHF in profits per year could set the drift such that the drift exactly cancels out the price change from buying back 100k CHF worth of shares per year.

## Example use case

The Brokerbot contract is the basis of the [Brokerbot widget](https://aktionariat.com/brokerbot.html), which can be seen in action on the [Aktionariat AG Investor Relations](https://aktionariat.com/investors.html#market) page.

## License Fee

For this smart contract, we created a new type of software license, the “[MIT License with Automated License Fee Payments](https://github.com/aktionariat/contracts/blob/master/LICENSE)”. Anyone is free to use the code as long as the built-in license fee, paid to [Aktionariat AG](https://aktionariat.com/), is preserved. The license fee is collected on sale transactions only, paid by the seller whenever a share is sold.

If you are interested in licensing the Brokerbot under different terms, get in touch with us.
