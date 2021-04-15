# Market

![bazaar marketplace](https://aktionariat.com/images/bazaar.jpg)

Documentation for the market-making smart contract implemented in [Market.sol](../src/Market.sol).

## Purpose

The Market Smart Contract provides mechanisms for the selling and repurchasing of shares with automated price adjustments.

## Features

* Automatic price increment per share bought (equal to decrement per share sold)
* Time based automatic drift

## Example use case

The Market Contract is the basis of our [Brokerbot widget](https://aktionariat.com/brokerbot.html), used for instance on the [Aktionariat AG Investor Relations](https://aktionariat.com/investors.html#market) page.

## License Fee

For this smart contract, we created a new type of software license, the “[MIT License with Automated License Fee Payments](https://github.com/aktionariat/contracts/blob/master/LICENSE)”. Anyone is free to reuse the code as long as the built-in license fee, paid to [Aktionariat AG](https://aktionariat.com/), is preserved. The license fee is collected on sale transactions only, paid by the seller whenever a share is sold.
