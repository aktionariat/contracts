
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./MultiSig.sol";

contract MultiSigFactory {

  function create() public returns (address) {
    return address(new MultiSig(msg.sender));
  }

  function predict(bytes32 salt) public view returns (address) {
    return address(uint(keccak256(abi.encodePacked(byte(0xff), address(this), salt,
            keccak256(abi.encodePacked(type(MultiSig).creationCode, msg.sender))
        ))));
  }

  function create(bytes32 salt) public returns (address) {
    return address(new MultiSig{salt: salt}(msg.sender));
  }
}