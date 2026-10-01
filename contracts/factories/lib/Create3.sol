// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

/**
 * @dev CREATE3: deploys a contract at an address that depends only on the deployer and the salt, not on the
 * bytecode or constructor arguments. A 16-byte proxy is created with CREATE2 and then runs CREATE, so the
 * final address is keccak(rlp(proxy, 1)). Used to give a token the same address on every chain.
 */
library Create3 {

    // Proxy init code: returns the 8-byte runtime 363d3d37363d34f0 (calldatacopy + create with the calldata).
    bytes32 internal constant PROXY_INITCODE_HASH = keccak256(hex"67363d3d37363d34f03d5260086018f3");

    /// @dev The proxy create2 returned zero: the salt was already used on this chain.
    error Create3_SaltAlreadyUsed(bytes32 salt);
    /// @dev The proxy ran but left no code at the target: the constructor reverted.
    error Create3_DeploymentFailed(address target);

    function deploy(bytes32 salt, bytes memory initCode) internal returns (address deployed) {
        address proxy;
        assembly ("memory-safe") {
            mstore(0x00, shl(128, 0x67363d3d37363d34f03d5260086018f3))
            proxy := create2(0, 0x00, 16, salt)
        }
        if (proxy == address(0)) revert Create3_SaltAlreadyUsed(salt);
        deployed = predict(salt);
        (bool success, ) = proxy.call(initCode);
        if (!success || deployed.code.length == 0) revert Create3_DeploymentFailed(deployed);
    }

    /// @dev The address `deploy(salt, ...)` produces when called from this contract.
    function predict(bytes32 salt) internal view returns (address) {
        return predict(address(this), salt);
    }

    function predict(address deployer, bytes32 salt) internal pure returns (address) {
        address proxy = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, PROXY_INITCODE_HASH)))));
        // rlp([proxy, 1]) = 0xd6 0x94 <20 bytes> 0x01
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), proxy, bytes1(0x01))))));
    }
}
