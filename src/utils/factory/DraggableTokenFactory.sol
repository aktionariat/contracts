// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Ownable } from "../Ownable.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { DraggableShares, DraggableParams } from "../../shares/DraggableShares.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { TokenConfig } from "./FactoryStructs.sol";



/**
 * @title Factory to deploy shares contracts and brokerbot
 * @author rube
 * 
 */
contract DraggableTokenFactory is Ownable {

  FactoryManager public manager;

  event DraggableTokenCreated(address indexed draggable, address indexed baseToken, address indexed owner, bool allowlist);
  event FactoryManagerUpdated(FactoryManager manager);

  error InvalidOwner();

  constructor(address _owner) Ownable(_owner){}

  function createDraggable(TokenConfig calldata tokenConfig, address tokenOwner, IERC20Permit token) external returns (IERC20Permit) {
    if (tokenOwner == address(0)) revert InvalidOwner();

    DraggableParams memory params = DraggableParams(token, tokenConfig.quorumDrag, tokenConfig.quorumMigration, tokenConfig.votePeriod);

    IERC20Permit draggable = new DraggableShares(tokenConfig.terms, params, manager.recoveryHub(), manager.offerFactory(), tokenOwner, manager.permit2Hub());
    emit DraggableTokenCreated(address(draggable), address(token), tokenOwner, tokenConfig.allowlist);
    return draggable;
    
  }

  function setManager(FactoryManager _manager) external onlyOwner {
    manager = _manager;
    emit FactoryManagerUpdated(manager);
  }

}