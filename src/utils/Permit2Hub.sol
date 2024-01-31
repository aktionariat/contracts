// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "../utils/Ownable.sol";

contract Permit2Hub is Ownable {

  uint8 private constant PERMIT_ENABLED = 1;
  uint8 private constant PERMIT_DISABLED = 2;
  
  uint8 public permit2Enabled = PERMIT_ENABLED;
  address public immutable permit2;

  mapping(address => bool) public permit2Disabled; // disable permit2 (e.g. for long term storage)

  event ChangedPermit2(uint8 newSetting);


  constructor(address _permit2, address _owner) Ownable(_owner) {
    permit2 = _permit2;
  }

  function isPermit2Enabled(address owner, address spender) public view  returns (bool){
    return spender == permit2 && permit2Enabled == PERMIT_ENABLED && ! permit2Disabled[owner];
  }

  // owner should be backend or a multsig of us
  // sets it global for all users
  function togglePermit2() external onlyOwner {
    permit2Enabled = permit2Enabled == PERMIT_ENABLED ? PERMIT_DISABLED : PERMIT_ENABLED;
    emit ChangedPermit2(permit2Enabled);
  }

  // for single users 
  function setPermit2(bool enabled) external  {
        permit2Disabled[msg.sender] = !enabled;
  }
}