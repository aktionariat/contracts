
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8;

import "./MultiSigWallet.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultiSigCloneFactory {

  address public multiSigImplementation;

  event ContractCreated(address contractAddress, string typeName);

  constructor(address _multSigImplementation) {
    multiSigImplementation = _multSigImplementation;
  }

  /*function create(address owner) public returns (address) {
    address payable instance = payable(Clones.clone(multiSigImplementation));
    MultiSigWallet(instance).initialize(owner);
    emit ContractCreated(instance, "MultiSigWallet");
    return instance;
  }*/

  function predict(bytes32 salt) public view returns (address) {
    return Clones.predictDeterministicAddress(multiSigImplementation, salt);
  }

  function create(address owner, bytes32 salt) public returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(multiSigImplementation, salt));
    MultiSigWallet(instance).initialize(owner);
    emit ContractCreated(instance, "MultiSigWallet");
    return instance;
  }
}