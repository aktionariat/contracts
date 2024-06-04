/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* Proprietary License
*
* This code cannot be used without an explicit permission from the copyright holder.
* If you wish to use the Aktionariat Brokerbot, you can either use the open version
* named Brokerbot.sol that can be used under an MIT License with Automated License Fee Payments,
* or you can get in touch with use to negotiate a license to use LicensedBrokerbot.sol .
*
* Copyright (c) 2022 Aktionariat AG (aktionariat.com), All rights reserved.
*/
pragma solidity ^0.8.0;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IBrokerbot} from "./IBrokerbot.sol";
import {IERC20} from "../ERC20/IERC20.sol";
import {Ownable} from "../utils/Ownable.sol";
import {TokenRegistry} from "./TokenRegistry.sol";

/// @title Brokerbot Registry
/// @notice Holds a registry from all deployed active brokerbots
contract BrokerbotRegistry is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;

  EnumerableSet.AddressSet private _brokerbotSet;
  EnumerableSet.AddressSet private _activeBrokerbotSet;

  /// @notice Returns the brokerbot address for a given pair base and share token, or address 0 if it does not exist
  /// @dev mapping is [base][token] = brokerbotAddress
  /// @return brokerbot The brokerbot address
  mapping(IERC20 => mapping(IERC20 => IBrokerbot)) public getBrokerbot;

  mapping(IERC20 => IBrokerbot) public activeBrokerbots;

  /// @notice Emitted when brokerbot is registered.
  /// @param brokerbot The address of the brokerbot
  /// @param base The address of the base currency
  /// @param token The address of the share token
  event RegisterBrokerbot(IBrokerbot brokerbot, IERC20 indexed base, IERC20 indexed token);

  /// @notice Emmitted when calling syncBrokerbot function
  /// @param brokerbot The brokerbot address that is synced
  event SyncBrokerbot(IBrokerbot indexed brokerbot);

  constructor(address _owner) Ownable(_owner) {
  }

  /// @notice Per network only one active brokerbot should exist per base/share pair
  /// @param _brokerbot The brokerbot contract that should be registered.
  function registerBrokerbot(IBrokerbot _brokerbot, TokenRegistry _tokenRegistry) external onlyOwner() {
    bool isNew = _brokerbotSet.add(address(_brokerbot));
    if (isNew) {
      IERC20 token = IERC20(_brokerbot.token());
      IERC20 base = IERC20(_brokerbot.base());
      if (address(activeBrokerbots[token]) != address(0)) {
        _activeBrokerbotSet.remove(address(activeBrokerbots[token]));
      }
      _activeBrokerbotSet.add(address(_brokerbot));
      activeBrokerbots[token] = _brokerbot;
      getBrokerbot[base][token] = _brokerbot;
      _tokenRegistry.addShareToken(address(token));
      emit RegisterBrokerbot(_brokerbot, base, token);
    }
  }

  /// @notice This event is usful for indexers/subgraphs to update token balances which are not tracked with other events
  /// @param _brokerbot The brokerbot that should be synced
  function syncBrokerbot(IBrokerbot _brokerbot) external {
    emit SyncBrokerbot(_brokerbot);
  }

  function getActiveBrokerbot(IERC20 token) external view returns(IBrokerbot) {
    return activeBrokerbots[token];
  }

  function getAllActiveBrokerbots() external view returns(address[] memory brokerbots) {
    return _activeBrokerbotSet.values();
  }

  function getAllBrokerbots() external view returns (address[] memory brokerbots) {
    return _brokerbotSet.values();
  }


}