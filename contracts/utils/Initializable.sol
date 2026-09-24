// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

/**
 * Minimal one-shot initializer guard, own code. Clones (EIP-1167) do not run a constructor, so their
 * setup happens in an `initialize` function that must be callable exactly once. The master contract
 * locks itself in its constructor so that nobody can initialize the master itself later.
 *
 * Deliberately not OpenZeppelin's Initializable: no reinitializer versions, no namespaced storage,
 * just one flag and one modifier.
 */
abstract contract Initializable {

    bool private _initialized;

    error Initializable_AlreadyInitialized();

    modifier initializer() {
        if (_initialized) {
            revert Initializable_AlreadyInitialized();
        }
        _;
        _initialized = true;
    }

    /**
     * Marks the contract as initialized without running an initializer. For the master contract
     * behind clones, whose own state is never used.
     */
    function _lockInitializer() internal {
        _initialized = true;
    }

}
