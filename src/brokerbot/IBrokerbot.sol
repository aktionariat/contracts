// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";

interface IBrokerbot {
  
  // Note that these settings might be hard-coded in various places, so better not change these values.
  function BUYING_ENABLED() external view returns(uint8) ; // 0x01
  function SELLING_ENABLED() external view returns(uint8) ; // 0x02
  // note that in the UI, we call the setting "convert ether", which is the opposite
  function KEEP_ETHER() external view returns(uint8) ; // 0x04

  function base() external view returns (address);
  
  function settings() external view returns (uint256);

  // @return The amount of shares bought on buying or how much in the base currency is transfered on selling
  function processIncoming(IERC20 token_, address from, uint256 amount, bytes calldata ref) external payable returns (uint256);

}