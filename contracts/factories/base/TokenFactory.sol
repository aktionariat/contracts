// SPDX-License-Identifier: LicenseRef-Aktionariat
pragma solidity ^0.8.26;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {BytecodeStore} from "./BytecodeStore.sol";
import {Deployment} from "../lib/Deployment.sol";

/**
 * @title TokenFactory
 * @notice Abstract base for CREATE2 token deployers. Stores a single creation
 *         bytecode and exposes the shared predict/deploy mechanics so concrete
 *         factories only declare their typed `predict`/`deploy` wrappers and
 *         their specific constructor-argument encoding.
 * @dev Subclasses build their constructor args with `abi.encode(...)` and pass
 *      them to `_predictAddress` / `_deployToken`.
 */
abstract contract TokenFactory is BytecodeStore {
    event TokenDeployed(address indexed deployed, string symbol);

    constructor() BytecodeStore() {}

    function _predictAddress(bytes32 salt, bytes memory args) internal view returns (address) {
        return Deployment.compute(bytecode, address(this), salt, args);
    }

    function _deployToken(bytes32 salt, bytes memory args, string calldata symbol) internal returns (address deployed) {
        deployed = _deployToken(salt, args);
        emit TokenDeployed(deployed, symbol);
    }

    /// @dev Deploys without emitting, for factories that need to read the
    ///      deployed token before emitting (e.g. its symbol).
    function _deployToken(bytes32 salt, bytes memory args) internal returns (address deployed) {
        bytes memory initCode = abi.encodePacked(bytecode, args);
        deployed = Create2.deploy(0, salt, initCode);
    }
}
