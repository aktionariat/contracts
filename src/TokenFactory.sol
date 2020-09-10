
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./Shares.sol";

contract TokenFactory {

  function createShares(bytes32 salt, string memory ticker, string memory name, string memory terms) public returns (address) {
    return address(new Shares{salt: salt}(msg.sender, ticker, name, terms));
  }
}