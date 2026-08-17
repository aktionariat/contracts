// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Minimal mock for the RMN (Risk Management Network) proxy.
/// Returns false for all curse checks, allowing pool operations to proceed in tests.
contract MockRMN {
    function isCursed(bytes16) external pure returns (bool) {
        return false;
    }
}
