// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

/**
 * @dev Holds the creation code of one contract in its own code section so that a deployer contract can
 * fetch it and append constructor arguments. Splitting the bytecodes into stores keeps every contract under
 * the 24 KB code-size limit. The store has no logic and no state.
 */
abstract contract BytecodeStore {

    function creationCode() external pure virtual returns (bytes memory);

    /// @dev VERSION of the contract this store deploys.
    function version() external pure virtual returns (uint256);
}
