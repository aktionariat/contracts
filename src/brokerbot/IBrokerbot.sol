// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";

interface IBrokerbot {
  
  function settings() external view returns (uint256);

  // @return The amount of shares bought on buying or how much in the base currency is transfered on selling
  function processIncoming(IERC20 token_, address from, uint256 amount, bytes calldata ref) external payable returns (uint256);

}