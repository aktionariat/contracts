// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBrokerbot {
  
  function base() external view returns (address);
  
  function settings() external view returns (uint256);

  function processIncoming(address token_, address from, uint256 amount, bytes calldata ref) external payable returns (uint256);

}