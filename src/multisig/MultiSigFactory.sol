
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.0;

import "./MultiSig.sol";

contract MultiSigFactory {

  event ContractCreated(address contractAddress, string typeName);

  function create(address owner) external returns (address) {
    address instance = address(new MultiSig(owner));
    emit ContractCreated(instance, "MultiSig");
    return instance;
  }

  function predict(address owner, bytes32 salt) external view returns (address) {
    bytes32 bytecodeHash = keccak256(abi.encodePacked(type(MultiSig).creationCode, abi.encode(owner)));
    bytes32 _data = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash));
    return address(uint160(uint256(_data)));
  }

  function create(address owner, bytes32 salt) external returns (address) {
    address instance = address(new MultiSig{salt: salt}(owner));
    emit ContractCreated(instance, "MultiSig");
    return instance;
  }
}