
/**
 * SPDX-License-Identifier: MIT
 * 
 * This is a work-around to address issue https://github.com/aktionariat/backend/issues/1518
 */
pragma solidity 0.8.29;

contract EtherForwarder {

  error InvalidNonce(uint256 expected, uint256 provided);
  error TransactionFailed(bytes data);

  mapping (address source => uint256 nonce) nonces;

  constructor() {
  }

  function forward(address target, uint256 nonce) payable external {
      if (nonces[msg.sender] != nonce) revert InvalidNonce(nonces[msg.sender], nonce);
      (bool success, bytes memory data) = target.call{ value: msg.value }("");
      if (!success) revert TransactionFailed(data);
  }

}