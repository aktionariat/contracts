
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./Shares.sol";
import "./DraggableShares.sol";

contract TokenFactory {

  function createShares(bytes32 salt, string memory ticker, string memory name, string memory terms) public returns (address) {
    return address(new Shares{salt: salt}(msg.sender, ticker, name, terms));
  }

  function createDraggable(bytes32 salt, string memory _terms, address baseContract, address currency, uint256 quorum) public returns (address) {
    return address(new DraggableShares{salt: salt}(_terms, baseContract, quorum, currency));
  }

}