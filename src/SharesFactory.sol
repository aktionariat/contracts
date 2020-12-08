
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./Shares.sol";

contract SharesFactory {

  event ContractDeployed(address contractAddress);

  function create(bytes32 salt, address owner, string memory ticker, string memory name, string memory terms, uint256 total) public returns (address) {
    Shares shares = new Shares{salt: salt}(ticker, name, terms);
    emit ContractDeployed(address(shares));
    shares.setTotalShares(total);
    shares.transferOwnership(owner);
    return address(shares);
  }
}