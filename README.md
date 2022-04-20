[![Coverage Status](https://coveralls.io/repos/github/aktionariat/contracts/badge.svg?branch=master)](https://coveralls.io/github/aktionariat/contracts?branch=master)

# Aktionariat Contracts

The public repository for all smart contracts used by Aktionariat.

## Overview

There are five notable smart contracts in this repository:
1. Our custom [Multisignature Contract](doc/multisig.md), providing the basis for corporate accounts with multiple signers.
2. The [ERC20Recoverable Contract](doc/recoverable.md), implementing our decentralized claim mechanism for lost tokens.
3. The [ERC20Draggable Contract](doc/draggable.md), implementing the drag-along clause found in many shareholder agreements.
4. The [ERC20Allowlistable Contract](doc/allowlist.md), providing a highly efficient and elaborate way to enforce transfer restrictions.
5. The [Brokerbot Contract](doc/market.md), providing mechanisms for the selling and repurchasing of shares with automated price adjustments.

Futhermore, there is a [Shares Contract](doc/shares.md) that can contains all the functions to reploy a token that can represent shares under Swiss law. Also, we'd like to point to our elegant implementation of [infinite allowances](doc/infiniteallowance.md).

## Full User Control

Generally, there are two approaches to add functionality to basic ERC20 tokens. A commonly used bad one and the better one we are trying to follow.

The first approach is what we call the "cat-in-the-bag" approach. This is followed by most issuers of non-trivial ERC20 tokens and allows them to arbitrarily change the functionality of the token at a later point in time. Under this approach, the users are only interacting with a proxy that in the background redirects all request to other smart contracts configurable by the issuer. That way, the issuer can arbitrarily update the contract, freeze tokens or even take them into their possession. This not only goes against the spirit of decentralized finance, but also against the [recommendations of the Swiss Blockchain Federation](https://blockchainfederation.ch/wp-content/uploads/2021/10/SBF-2021-01-Ledger_Based_Securities_2021-10-12.pdf) and potentially also against the [legal requirements for security tokens](https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de#art_973_d), which require the owners, but not the issuer, to have control over their tokens.

We believe in a modular approach in which functionality is added by composition, thereby providing much stronger property rights to the token holders. Under the modular approach, a basic ERC20 token with minimal functionality is issued first. In our case, this base token is reflected by the smart contract simply named [Shares](src/Shares.sol). It is designed to (hopefully) last for as long as the Ethereum network exists. New featues are added not by changing the base token, but by wrapping them into tokens with additional functionality. For example, all [Aktionariat AG Shares (AKS)](https://etherscan.io/token/0xcB58EC733Ab0d96216B048bf7C3209d6c184D7c3) in circulation have been wrapped by [Draggable Aktionariat AG Shares (DAKS)](https://etherscan.io/token/0x6f38e0f1a73c96cB3f42598613EA3474F09cB200) token before selling them. Once the drag-along clause get triggered in an acquisition of if the majority of token holders vote to terminate the shareholder agreement, holders of DAKS token can unwrap them to convert them back to AKS tokens, which then could be wrapped into a new contract representing a new shareholder agreement. Under the modular approach, updates of the functionality of a token require the consent of the token holders and these updates are reflected by an explicit change of the contract users interact with.

## Shareholder Registry

Companies that choose Aktionariat as tokenization provider get access to a corporate dashboard on which board members can issue multisignature transaction to configure their smart contract. Furthermore, they get access to an electronic shareholder registry that shows which shareholder holds how many shares and that is automatically updated to reflect all blockchain-based token transfers. All personal data is stored in our database and not on the blockchain. In order to become a registered shareholer, token holders must provide their name and address and prove ownership of their tokens, which can be done through a widget on the issuer's website or our app.

This approach reflects how paper certificates are handled, with the paper corresponding to the tokens. Owners of certificated shares are free to hand them over to anyone at any time, but to actually enjoy any shareholder rights, the new owner must register themselves with the company. This enables short-term trading of the token without registration, while at the same time provides a strong incentive for long-term shareholders to actually register themselves in the shareholder registry. See also the [recommendations of the Swiss Blockchain Federation](https://blockchainfederation.ch/wp-content/uploads/2021/10/SBF-2021-01-Ledger_Based_Securities_2021-10-12.pdf).

## Bug Bounty

If you find a new security-relevant bug in our contracts and tell us, we will reward you with 1 Ether. For bugs that could lead to a loss of funds, the bounty is tripled. The bounty can only be claimed for bugs that we are not aware of and that have not been exploited yet. They must be filed directly to bugs@aktionariat.com without opening a publicly visible issue.

## Development Quick Start

### Dependencies

You'll need the following:

* [Git](https://git-scm.com/downloads)
* [NodeJS](https://nodejs.org/en/download/)
* [Yarn](https://classic.yarnpkg.com/en/docs/install)

### Setup

Clone the repository, open it, and install nodejs packages with `yarn`:

```bash
git clone git@github.com:aktionariat/contracts.git
cd contracts
yarn install
```

#### Local node
to run a local node use
```bash
yarn hardhat node
```
(it will use on your default network, to use on a different network use --network <name>)

#### Compile

```bash
yarn compile
```

#### Running unit tests

```bash
yarn test
```

### Deploy Contract

```bash
yarn hardhat deploy --network ropsten
```
This will run all deployment scripts in the deploy folder. To specify seperate deployments use tags.

#### Verify Contract on Etherscn

```bash
yarn hardhat --network ropsten etherscan-verify
```

(don't forget to set ETHERSCAN_API_KEY in .env)

#### Clone hardhat tasks
task to create a multisig clone from the clonefactory: create-multisig-clone

```bash
yarn hardhat create-multisig-clone --factory <multisigCloneFactory_Address> --owner <address> --salt <string_which_gets_formated_in_byte32>
```
(it will run on your default network, to run on a different network use --network <name>)

## License

All our smart contracts are open-source and can be used under a slightly modified [MIT License with Automated License Fee Payments](LICENSE). This means that you are free to use our contracts as long as you do not make any changes to circumvent the built-in license fee payments to our address [0x29Fe8914e76da5cE2d90De98a64d0055f199d06D](https://etherscan.io/address/0x29fe8914e76da5ce2d90de98a64d0055f199d06d), if there are any. Note that some of the source code you find in this repository stems from other sources with other licenses. These are marked accordingly.
