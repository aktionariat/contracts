
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.0;

import "./MultiSigWallet.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultiSigCloneFactory {

  address public multiSigImplementation;

  event ContractCreated(address contractAddress, string typeName);

  constructor(address _multiSigImplementation) {
    multiSigImplementation = _multiSigImplementation;
  }
  
  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(multiSigImplementation, salt);
  }

  function create(address owner, bytes32 salt) external returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(multiSigImplementation, salt));
    MultiSigWallet(instance).initialize(owner);
    emit ContractCreated(instance, "MultiSigWallet");
    return instance;
  }
}