// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { DraggableShares, DraggableParams } from "../../shares/DraggableShares.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { TokenConfig } from "./FactoryStructs.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { Ownable } from "../Ownable.sol";

/**
 * @title Draggable token factory
 * @author rube
 * 
 * @notice This contract is responsible for creating new Draggable tokens
 * @dev Inherits from Ownable for access control
 */
contract DraggableTokenFactory is Ownable {

  /// @notice The factory manager contract
  FactoryManager public manager;

  /**
   * @notice Emitted when the factory manager is updated
   * @param manager The address of the new factory manager
   */
  event FactoryManagerUpdated(FactoryManager manager);

  /**
   * @notice Constructs the DraggableTokenFactory contract
   * @param _owner The address that will be set as the owner of this contract
   */
  constructor(address _owner) Ownable(_owner){}

  /**
   * @notice Creates a new Draggable token
   * @dev This function deploys a new DraggableShares contract
   * @param tokenConfig The configuration for the new token
   * @param tokenOwner The address that will own the new token
   * @param token The ERC20Permit token to be wrapped
   * @return IERC20Permit The address of the newly created Draggable token
   */
  function createDraggable(TokenConfig calldata tokenConfig, address tokenOwner, IERC20Permit token) external returns (IERC20Permit) {
    bytes32 salt = bytes32(keccak256(abi.encodePacked(tokenConfig.symbol)));
    DraggableParams memory params = DraggableParams(
      token, 
      tokenConfig.quorumDrag, 
      tokenConfig.quorumMigration, 
      tokenConfig.votePeriod
    );

    return new DraggableShares{salt: salt}(
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