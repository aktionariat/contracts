
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8;

import "./MultiSig.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultiSigCloneFactory {

  address public multiSigImplementation;

  event ContractCreated(address contractAddress, string typeName);

  function create(address owner) public returns (address) {
    address payable instance = payable(Clones.clone(multiSigImplementation);
    MultiSig(instance).initialize(owner);
    emit ContractCreated(instance, "MultiSig");
    return instance;
  }

  function predict(address owner, bytes32 salt) public view returns (address) {
    return Clones.predictDeterministicAddress(multiSigImplementation, salt);
  }

  function create(address owner, bytes32 salt) public returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(multiSigImplementation, salt));
    MultiSig(instance).initialize(owner);
    emit ContractCreated(instance, "MultiSig");
    return instance;
  }
}