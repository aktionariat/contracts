
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.7;

import "./MultiSig.sol";

contract MultiSigFactory {

  function create() public returns (address) {
    return address(new MultiSig(msg.sender));
  }
}