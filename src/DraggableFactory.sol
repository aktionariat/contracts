
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./DraggableShares.sol";

contract DraggableFactory {

  function create(bytes32 salt, string memory _terms, address baseContract, uint256 quorum) public returns (address) {
    return address(new DraggableShares{salt: salt}(_terms, baseContract, quorum));
  }

}