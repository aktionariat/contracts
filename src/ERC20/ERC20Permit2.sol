// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "./ERC20Flaggable.sol";
import "./Permit2Hub.sol";

abstract contract ERC20Permit2 is ERC20Flaggable {

  Permit2Hub public immutable permit2Hub;

  constructor(Permit2Hub _permit2Hub) {
    permit2Hub = _permit2Hub;
  }

  function allowance(address owner, address spender) public view virtual override(ERC20Flaggable) returns (uint256) {
    if (permit2Hub.isPermit2Enabled(owner, spender)) return type(uint256).max;
    return super.allowance(owner, spender);
  }
}