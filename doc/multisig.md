# Multi-Signature Contract

![multi-signature](https://hub.aktionariat.com/images/contracts/old-keys.jpg)

Aktionariat uses a custom [Multisignature Contract](../src/multisig/MultiSigWalletMaster.sol) for its corporate clients. The purpose of the multisignature contract is to reflect the real signatory powers of the board members and to guard against losses or theft of the private key of an individual board member.

Our multisignature contract is designed to be used with the standard transaction signing mechanism. For example, if 100 XCHF shall be moved from the corporate multisig contract of Aktionariat, the two board members each sign an according ERC‑20 transfer transaction. But instead of sending the signed transactions to the network, they are stored in our database. Once there are enough signatures to execute the transaction, our server reads the signatures from the database and sends all of them along with the signed transaction data to the multisig contract. The multisig contract verifies the signatures and executes the actual transaction like other multisignature scheme.

Our approach comes with a number of advantages:

1. The signers can actually sign data that conforms to the standard transaction format supported by many wallets. This ensures a high level of compatibility as well as user-friendliness. All that’s needed is a wallet that supports signing offline transactions. (As a notable exception, the MetaMask browser plugin [unfortunately does not](https://github.com/MetaMask/metamask-extension/issues/7644).)

2. There is only one transaction that needs to be sent to the blockhain network. With our architecture, the transaction fee only needs to be paid once and can be paid for by whoever collected the signed transaction. In our case, this is the Aktionariat server. This allows our client to execute corporate actions without having to worry about transaction fees or running out of gas.

3. It can reflect the standard corporate signatory powers, which allows to have signers with different signatory powers. For example, one signer might have single-signatory power, being able to sign transactions alone, while others are required to sign along with one or more co-signers.

The address of our own multisignature contract is [0x4Fd9DbA1d53B7E6cC933a2Fdd12B1c012a0654F6](https://etherscan.io/address/0x4Fd9DbA1d53B7E6cC933a2Fdd12B1c012a0654F6#code). If you want to use this multisignature contract for your own purpose outside the context of Aktionariat, feel free to get in touch. We have built a few server-side tools to support the transaction workflow that might be useful to you in such a case.
