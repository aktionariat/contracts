// SPDX-License-Identifier: MIT


pragma solidity ^0.8.0;


import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


import { Ownable } from "../Ownable.sol";
import { PaymentHub } from "../../brokerbot/PaymentHub.sol";
import { Brokerbot } from "../../brokerbot/Brokerbot.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { IERC20 } from "../../ERC20/IERC20.sol";
import { BrokerbotRegistry } from "../../brokerbot/BrokerbotRegistry.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { BrokerbotConfig } from "./FactoryStructs.sol";


contract BrokerbotFactory is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;

  FactoryManager public manager;
  EnumerableSet.AddressSet private _brokerbotSet; 
  
  event BrokerbotCreated(Brokerbot indexed brokerbot, IERC20Permit indexed token, address indexed owner);
  event FactoryManagerUpdated(FactoryManager manager);

  constructor(address _owner) Ownable(_owner){}

  function createBrokerbot(BrokerbotConfig memory brokerbotConfig, IERC20Permit token, address multisig) public returns(Brokerbot) {
    Brokerbot brokerbot = new Brokerbot(token, brokerbotConfig.price, brokerbotConfig.increment, brokerbotConfig.baseToken, multisig, address(manager.paymentHub()));
    _brokerbotSet.add(address(brokerbot));
    emit BrokerbotCreated(brokerbot, token, multisig);
    return brokerbot;
  }

  function setManager(FactoryManager _manager) external onlyOwner() {
    manager = _manager;
    emit FactoryManagerUpdated(manager);
  }

  /**
   * @notice Gets all registered brokerbots
   * 
   * @return brokerbots An array of all registered brokerbot addresses
   */
  function getAllBrokerbots() external view returns (address[] memory brokerbots) {
      return _brokerbotSet.values();
  }

}

