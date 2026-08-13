// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../../../multisig/MultiSigWallet.sol";

/**
 * Test-only harness exposing MultiSigWallet.calculateTransactionHash, which is
 * internal, so tests can build valid signatures for a wallet transaction.
 */
contract MultisigHashHarness is MultiSigWallet {
    function getTransactionHash(uint128 sequence, bytes memory id, address to, uint value, bytes calldata data)
        external view returns (bytes32) {
        return calculateTransactionHash(sequence, id, to, value, data);
    }
}
