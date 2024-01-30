// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "./ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract ERC20Permit2 is ERC20Flaggable, Ownable {

  uint8 private constant FLAG_DISABLE_PERMIT2 = 2;
  uint8 private constant PERMIT_ENABLED = 1;
  uint8 private constant PERMIT_DISABLED = 2;
  
  uint8 public permit2Enabled = PERMIT_ENABLED;
  address public immutable permit2;

  event ChangedPermit2(uint8 newSetting);


  constructor(address _permit2) {
    permit2 = _permit2;
  }

  function isPermit2Enabled(address addr) public view  returns (bool){
    return permit2Enabled == PERMIT_ENABLED && ! hasFlagInternal(addr, FLAG_DISABLE_PERMIT2);
  }

  function allowance(address owner, address spender) public view virtual override(ERC20Flaggable) returns (uint256) {
    if (spender == permit2 && isPermit2Enabled(owner)) return type(uint256).max;
    return super.allowance(owner, spender);
  }

  function togglePermit2() external onlyOwner {
    permit2Enabled = permit2Enabled == PERMIT_ENABLED ? PERMIT_DISABLED : PERMIT_ENABLED;
    emit ChangedPermit2(permit2Enabled);
  }
}