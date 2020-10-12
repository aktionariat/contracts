
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./Shares.sol";

contract SharesFactory {

  function create(bytes32 salt, string memory ticker, string memory name, string memory terms) public returns (address) {
    Shares shares = new Shares{salt: salt}(address(this), ticker, name, terms);
    shares.transferOwnership(msg.sender);
    return address(shares);
  }
}