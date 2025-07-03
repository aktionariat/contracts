// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../utils/Ownable.sol";

/// @title Permit2Hub
/// @dev This contract manages the Permit2 functionality and access control.
contract Permit2Hub is Ownable {
  
  /// @dev The address of the Permit2 contract.
  address public immutable permit2;
  /// @dev Flag to indicate whether Permit2 is disabled.
  bool public permit2Disabled = false;

  /// @dev Mapping to track addresses for which Permit2 is disabled.
  mapping(address => bool) public permit2DisabledForAddress;

  /// @dev Emitted when the Permit2 setting is changed.
  event ChangedPermit2(bool newSetting);

  /// @dev Initializes the Permit2Hub contract with the provided Permit2 address and owner address.
  /// @param _permit2 The address of the Permit2 contract.
  /// @param _owner The address of the owner.
  constructor(address _permit2, address _owner) Ownable(_owner) {
    permit2 = _permit2;
  }

  /// @dev Checks if Permit2 is enabled for the given owner and spender addresses.
  /// @param owner The owner address.
  /// @param spender The spender address, needs to be the permit2 contract.
  /// @return A boolean indicating whether Permit2 is enabled.
  function isPermit2Enabled(address owner, address spender) public view returns (bool){
    return spender == permit2 && !permit2Disabled && !permit2DisabledForAddress[owner];
  }

  /// @dev Toggles the global Permit2 setting. Can only be called by the owner.
  function togglePermit2() external onlyOwner {
    permit2Disabled = !permit2Disabled;
    emit ChangedPermit2(permit2Disabled);
  }

  /// @dev Sets the Permit2 status for a specific address.
  /// @param enabled The status to set for the address.
  function setPermit2(bool enabled) external {
    permit2DisabledForAddress[msg.sender] = !enabled;
  }
}
