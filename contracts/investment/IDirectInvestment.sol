// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/IERC20.sol";

interface IDirectInvestment {
  function base() external view returns (IERC20);
  function token() external view returns (IERC20);
  function paymenthub() external view returns (address);

  function getBuyPrice(uint256 shares) external view returns (uint256);
  function processIncoming(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) external;

  error DirectInvestment_BuyingDisabled();
  error DirectInvestment_InvalidSettings();
  error DirectInvestment_NotPaymentHub(address sender);
  error DirectInvestment_InsufficientPayment(uint256 required, uint256 provided);
}
