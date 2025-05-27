/**
 * SPDX-License-Identifier: MIT
 * 
 * This is a work-around to address issue https://github.com/aktionariat/backend/issues/1518
 */
pragma solidity 0.8.30;

import "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

contract EtherForwarder is ReentrancyGuardTransient {
  function forward(address target) payable external nonReentrant {
    (bool success, ) = target.call{ value: msg.value }("");
    require(success, "Failed to send Ether through EtherForwarder");
  }
}