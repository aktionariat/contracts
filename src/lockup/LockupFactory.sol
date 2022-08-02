
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.0;

import "./LockupShares.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract LockupFactory {

  address immutable public lockupSharesImplementation;

  event LockupContractCreated(address indexed contractAddress, string indexed typeName);

  constructor(address _lockupSharesImplementation) {
    lockupSharesImplementation = _lockupSharesImplementation;
  }
  
  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(lockupSharesImplementation, salt);
  }

  function create(address owner, address company, IERC20 token, uint256 lockupPeriod, bytes32 salt) external returns (LockupShares) {
    address payable instance = payable(Clones.cloneDeterministic(lockupSharesImplementation, salt));
    LockupShares(instance).initialize(owner, company, token, lockupPeriod);
    emit LockupContractCreated(instance, "LockupShares");
    return LockupShares(instance);
  }
}