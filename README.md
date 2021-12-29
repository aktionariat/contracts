# Aktionariat Contracts

The public repository for all smart contracts used by Aktionariat.

## Overview

There are five notable smart contracts in this repository:
1. Our custom [Multisignature Contract](doc/multisig.md), providing the basis for corporate accounts with multiple signers.
2. The [ERC20Recoverable Contract](doc/recoverable.md), implementing our decentralized claim mechanism for lost tokens.
3. The [ERC20Draggable Contract](doc/draggable.md), implementing the drag-along clause found in many shareholder agreements.
4. The [Brokerbot Contract](doc/market.md), providing mechanisms for the selling and repurchasing of shares with automated price adjustments.
5. The [ERC20Allowlistable Contract](doc/allowlist.md), providing a highly efficient and elaborate way to enforce transfer restrictions.

## Full User Control

Generally, there are two approaches to add functionality to basic ERC20 tokens. A commonly used bad one and the better one we are trying to follow.

The first approach is what we call the "cat-in-the-bag" approach. This is followed by most issuers of non-trivial ERC20 tokens and allows them to arbitrarily change the functionality of the token at a later point in time. Under this approach, the users are only interacting with a thin interface that in the background redirects all request to other smart contracts configurable by the issuer. That way, the issuer can arbitrarily update the contract, freeze tokens or even take them into their possession. This not only goes against the spirit of decentralized finance, but also against the [recommendations of the Swiss Blockchain Federation](http://blockchainfederation.ch/wp-content/uploads/2019/12/SBF-Circular-2019-01-Tokenized-Equity-4.pdf) and potentially also against the upcoming [legal requirements for security tokens](https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=20190074).

We believe in a modular approach in which functionality is added by composition, thereby providing much stronger property rights to the token holders. Under the modular approach, a basic ERC20 token with minimal functionality is issued first. In our case, this base token is reflected by the smart contract simply named [Shares](src/Shares.sol). It is designed to (hopefully) last for as long as the Ethereum network exists. New featues are added not by changing the base token, but by wrapping them into tokens with additional functionality. For example, all [ServiceHunter AG Shares (SHS)](https://etherscan.io/token/0xbc41f5259e10e36341ff0da77a5870abc698de56) in circulation have been wrapped by [Draggable ServiceHunter AG Shares (DSHS)](https://etherscan.io/token/0x414324b0aba49fb14cbfb37be40d8d78a2edf447) token before selling them. Once the drag-along clause get triggered in an acquisition of if the majority of token holders vote to terminate the shareholder agreement, holders of DSHS token can unwrap them to convert them back to SHS tokens, which then could be wrapped into a new contract representing a new shareholder agreement. Under the modular approach, updates of the functionality of a token require the consent of the token holders, thereby ensuring that they actually possess what they own.

## Issuance

1. The ERC20 equity contract [Shares](src/Shares.sol) is deployed with the desired parameters. This contract supports claims as it inherits from [ERC20Claimable](claimable.md). A currency token such as XCHF can be set as a custom collateral. The issuer is the owner of this contract.
2. The ERC20 draggable contract [DraggableShares](src/DraggableShares.sol) is deployed. This contract does not have an owner and could in principle be deployed by anyone. It is controlled by the token holders by majority vote.
3. To issue basic shares, the 'mint' function can be called^ on the shares contract. Holders can convert base shares at any time into draggable shares by sending them to the draggable contract or calling the 'wrap' function. Alternatively, it is also possible to directly mint wrapped shares with the 'mintAndCall' function, enabling the issuer to mint, wrap and transfer shares directly to the right owner in one transaction.

## Shareholder Registry

Companies that choose Aktionariat as tokenization provider get access to a corporate dashboard on which board members can issue multisignature transaction to configure their smart contract. Furthermore, they get access to an electronic shareholder registry that shows which shareholder holds how many shares and that is automatically updated to reflect all blockchain-based token transfers. All personal data is stored in our database and not on the blockchain. In order to become a registered shareholer, token holders must provide their name and address and prove ownership of their tokens, which can be done through a widget on the issuer's website or our app.

This approach reflects how paper certificates are handled, with the paper corresponding to the tokens. Owners of certificated shares are free to hand them over to anyone at any time, but to actually enjoy any shareholder rights, the new owner must register themselves with the company. This enables short-term trading of the token without registration, while at the same time provides a strong incentive for long-term shareholders to actually register themselves in the shareholder registry.

This approach corresponds to the [recommendations of the Swiss Blockchain Federation](http://blockchainfederation.ch/wp-content/uploads/2019/12/SBF-Circular-2019-01-Tokenized-Equity-4.pdf).

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
