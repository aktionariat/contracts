// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {BrokerbotRegistry} from "./BrokerbotRegistry.sol";
import {Ownable} from "../utils/Ownable.sol";

contract TokenRegistry is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;

  EnumerableSet.AddressSet private _shareTokenSet;

  BrokerbotRegistry public brokerbotRegistry;

  event ShareTokenAdded(address adr);

  event ShareTokenRemoved(address adr);

  event BrokerbotRegistryUpdated(BrokerbotRegistry adr);

  error TokenRegistry__Unauthorized();

  constructor(address _owner, BrokerbotRegistry _brokerbotRegistry) Ownable(_owner) {
    brokerbotRegistry = _brokerbotRegistry;
  }

  modifier onlyOwnerOrRegistry() {
    if(msg.sender != owner && msg.sender != address(brokerbotRegistry))
      revert TokenRegistry__Unauthorized();
    _;
  }

  function setBrokerbotRegistry(BrokerbotRegistry _brokerbotRegistry) external onlyOwner() {
    brokerbotRegistry = _brokerbotRegistry;
    emit BrokerbotRegistryUpdated(_brokerbotRegistry);
  }

  function addShareToken(address adr) external onlyOwnerOrRegistry() returns(bool) {
    bool added = _shareTokenSet.add(adr);
    if (added) emit ShareTokenAdded(adr);
    return added;
  }

  function removeShareToken(address adr) external onlyOwner() returns(bool) {
    bool removed =_shareTokenSet.remove(adr);
    if (removed) emit ShareTokenRemoved(adr);
    return removed;
  }

  function cointainsShareToken(address adr) external view returns (bool) {
    return _shareTokenSet.contains(adr);
  }

  function amountOfShareToken() external view returns (uint256) {
    return _shareTokenSet.length();
  }

  function getAllShareToken() external view returns (address[] memory) {
    return _shareTokenSet.values();
  }
}