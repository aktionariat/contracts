# Multi-Signature Contract

Aktionariat uses a custom [Multisignature Contract](../src/MultiSig.sol) for its corporate clients. The purpose of the multisignature contract is to reflect the real signatory powers of the board members and to guard against losses or theft of the private key of an individual board member.

Unlike the other multisignature contracts we know, our multisignature contract is designed to be used with the standard transaction signing mechanism. For example, if 100 XCHF shall be moved from the corporate multisig contract of Aktionariat, the two board members each sign an according ERC20-transfer transaction. But instead of sending the signed transactions to the network, they are stored in our database. Once there are enough signatures to execute the transaction, our server reads the signatures from the database and sends all of them along with the signed transaction data to the multisig contract. The multisig contract verifies the signatures and executes the actual transaction like other multisignature scheme.

Our approach comes with a number of advantages in comparison to other multisignature contracts:

1. The signers do not need to sign a cryptic message, but can actually sign data that conforms to the standard transaction format supported by many wallets. This ensures a high level of compatibility as well as user-friendliness. All that’s needed is a wallet that supports signing offline transactions. (As a notable exception, the MetaMask browser plugin [unfortunately does not](https://github.com/MetaMask/metamask-extension/issues/7644).)

2. There is only one transaction that needs to be sent to the Ethereum network. Other multisignature schemes require every signer to execute their own transaction on chain, paying a transaction fee each for each provided signature. In contrast, with our architecture, the transaction fee only needs to be paid once and can be paid for by whoever collected the signed transaction. In our case, this is the Aktionariat server. This allows our client to execute corporate actions without having to worry about transaction fees or running out of gas.

3. It can reflect the standard corporate signatory powers, which allows to have signers with different signatory powers. For example, one signer might have single-signatory power, being able to sign transactions alone, while others are required to sign along with one or more co-signers.

The address of our own multisignature contract is [0xad358024fecb1b5d58125f5bef06fabfe657e4c7](https://etherscan.io/address/0xad358024fecb1b5d58125f5bef06fabfe657e4c7#code). If you want to use this multisignature contract for your own purpose outside the context of Aktionariat, feel free to get in touch. We have built a few server-side tools to support the transaction workflow that might be useful to you in such a case.
