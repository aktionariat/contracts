
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./DraggableShares.sol";

contract DraggableFactory {

  event ContractDeployed(address contractAddress);

  function create(bytes32 salt, string memory _terms, address baseContract, uint256 quorum) public returns (address) {
    DraggableShares draggableShares = new DraggableShares{salt: salt}(_terms, baseContract, quorum);
    emit ContractDeployed(address(draggableShares));
    return address(draggableShares);
  }
}