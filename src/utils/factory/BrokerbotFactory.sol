// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { Brokerbot } from "../../brokerbot/Brokerbot.sol";
import { BrokerbotRegistry } from "../../brokerbot/BrokerbotRegistry.sol";
import { BrokerbotConfig } from "./FactoryStructs.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { Ownable } from "../Ownable.sol";
import { PaymentHub } from "../../brokerbot/PaymentHub.sol";

/**
 * @title Brokerbot Factory
 * @author rube
 * 
 * @notice This contract is used to create Brokerbot contracts.
 */
contract BrokerbotFactory is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;

  /// @notice The manager responsible for factory operations
  FactoryManager public manager;

  /// @notice Set of all Brokerbot addresses created by this factory
  EnumerableSet.AddressSet private _brokerbotSet; 
  
  /// @notice Emitted when a new Brokerbot is created
  /// @param brokerbot The address of the created Brokerbot
  /// @param token The token used by the Brokerbot
  /// @param owner The owner of the Brokerbot
  event BrokerbotCreated(Brokerbot indexed brokerbot, IERC20Permit indexed token, address indexed owner);
  
  /// @notice Emitted when the FactoryManager is updated
  /// @param manager The new FactoryManager
  event FactoryManagerUpdated(FactoryManager manager);

  /// @notice Error for invalid owner address
  error InvalidOwner();

  /**
   * @notice Constructor to set the owner of the factory
   * @param _owner The address of the factory owner
   */
  constructor(address _owner) Ownable(_owner) {}

  /**
   * @notice Creates a new Brokerbot with the specified configuration
   * @param brokerbotConfig The configuration for the new Brokerbot
   * @param token The token to be used by the Brokerbot
   * @param multisig The address of the multisig wallet for the Brokerbot
   * @return brokerbot The address of the created Brokerbot
   */
  function createBrokerbot(BrokerbotConfig memory brokerbotConfig, IERC20Permit token, address multisig) 
    public 
    returns (Brokerbot) 
  {
    if (multisig == address(0)) revert InvalidOwner();
    bytes32 salt = bytes32(uint256(keccak256(abi.encodePacked(token, brokerbotConfig.price, brokerbotConfig.baseCurrency))));
    Brokerbot brokerbot = new Brokerbot{salt:salt}(
      token, 
      brokerbotConfig.price, 
      brokerbotConfig.increment, 
      brokerbotConfig.baseCurrency,
      multisig,
      address(manager.paymentHub())
    );
    
    _brokerbotSet.add(address(brokerbot));
    emit BrokerbotCreated(brokerbot, token, multisig);
    return brokerbot;
  }

  /**
   * @notice Sets the manager for the factory
   * @param _manager The address of the new FactoryManager
   */
  function setManager(FactoryManager _manager) external onlyOwner {
    manager = _manager;
    emit FactoryManagerUpdated(manager);
  }

  /**
   * @notice Gets all registered brokerbots
   * @return brokerbots An array of all registered brokerbot addresses
   */
  function getAllBrokerbots() external view returns (address[] memory brokerbots) {
      return _brokerbotSet.values();
  }
}
