// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

/**
 * @dev CREATE2 for contracts whose constructor records msg.sender, such as Chainlink's pools and lockbox:
 * the deploying contract is the sender and thus the initial owner. The address depends on the init code.
 */
library Create2 {

    error Create2_DeploymentFailed(bytes32 salt);

    function deploy(bytes32 salt, bytes memory initCode) internal returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (deployed == address(0)) revert Create2_DeploymentFailed(salt);
    }

    function predict(bytes32 salt, bytes memory initCode) internal view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(initCode))))));
    }
}
