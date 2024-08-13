// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AllowlistDraggableShares, DraggableParams } from "../../shares/AllowlistDraggableShares.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { TokenConfig } from "./FactoryStructs.sol";
import { Ownable } from "../Ownable.sol";

/**
 * @title Allowlist draggable factory
 * @author rube
 * 
 * @notice This contract is responsible for creating new AllowlistDraggableShares tokens
 * @dev Inherits from Ownable for access control
 */
contract AllowlistDraggableFactory is Ownable {

    /// @notice The factory manager contract
    FactoryManager public manager;

    /// @notice Emitted when the factory manager is updated
    /// @param manager The new factory manager address
    event FactoryManagerUpdated(FactoryManager manager);

    /**
     * @notice Constructs a new AllowlistDraggableFactory
     * @param _owner The address that will be set as the owner of the contract
     */
    constructor(address _owner) Ownable(_owner){}

    /**
     * @notice Creates a new AllowlistDraggableShares token
     * @param tokenConfig The configuration for the new token
     * @param tokenOwner The address that will own the new token
     * @param token The address of the ERC20Permit token to be used
     * @return IERC20Permit The address of the newly created AllowlistDraggableShares token
     */
    function createAllowlistDraggable(TokenConfig calldata tokenConfig, address tokenOwner, IERC20Permit token, string calldata _salt) external returns (IERC20Permit) {
        bytes32 salt = bytes32(keccak256(abi.encodePacked(tokenConfig.symbol, token, _salt)));
        DraggableParams memory params = DraggableParams(
            token,
            tokenConfig.quorumDrag,
            tokenConfig.quorumMigration,
            tokenConfig.votePeriod
        );

        return new AllowlistDraggableShares{salt: salt}(
            tokenConfig.terms,
            params, 
            manager.recoveryHub(),
            manager.offerFactory(),
            tokenOwner,
            manager.permit2Hub()
        );
    }

    /**
     * @notice Sets a new factory manager
     * @dev Can only be called by the contract owner
     * @param _manager The address of the new factory manager
     */
    function setManager(FactoryManager _manager) external onlyOwner {
        manager = _manager;
        emit FactoryManagerUpdated(manager);
    }

}