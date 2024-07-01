// SPDX-License-Identifier: MIT


pragma solidity ^0.8.0;


import { Ownable } from "../Ownable.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { AllowlistShares, Shares } from "../../shares/AllowlistShares.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { DraggableTokenFactory } from "./DraggableTokenFactory.sol";
import { AllowlistDraggableFactory } from "./AllowlistDraggableFactory.sol";
import { TokenConfig } from "./FactoryStructs.sol";

/**
 * @title Factory to deploy shares contracts and brokerbot
 * @author rube
 * 
 */
contract TokenFactory is Ownable {

  FactoryManager public manager;
  DraggableTokenFactory public draggableFactory;
  AllowlistDraggableFactory public allowlistDraggableFactory;

  event BaseTokenCreated(IERC20Permit indexed token, address indexed owner, bool allowlist);
  event FactoryManagerUpdated(address manager);

  error InvalidOwner();

  constructor(address _owner, DraggableTokenFactory _draggableFactory, AllowlistDraggableFactory _allowlistDraggableFactory) Ownable(_owner){
    draggableFactory = _draggableFactory;
    allowlistDraggableFactory = _allowlistDraggableFactory;
  }

  function createToken(TokenConfig calldata tokenConfig, address tokenOwner) public returns (IERC20Permit) {
    if (tokenOwner == address(0))
      revert InvalidOwner();
    IERC20Permit token;
    if (tokenConfig.allowlist) {
      token = new AllowlistShares(tokenConfig.symbol, tokenConfig.name, tokenConfig.terms, tokenConfig.numberOfShares, manager.recoveryHub(), tokenOwner, manager.permit2Hub());
    } else {
      token = new Shares(tokenConfig.symbol, tokenConfig.name, tokenConfig.terms, tokenConfig.numberOfShares, tokenOwner, manager.recoveryHub(), manager.permit2Hub());
    }
    emit BaseTokenCreated(token, tokenOwner, tokenConfig.allowlist);
    if (tokenConfig.draggable) {
      IERC20Permit draggable;
      if (tokenConfig.allowlist) {
        draggable = allowlistDraggableFactory.createAllowlistDraggable(tokenConfig, tokenOwner, token);
      } else {
        draggable = draggableFactory.createDraggable(tokenConfig, tokenOwner, token);
      }
      return draggable;
    } else {
      return token;
    }
  }

  function setManager(FactoryManager _manager) external onlyOwner() {
    manager = _manager;
    emit FactoryManagerUpdated(address(manager));
  }

}