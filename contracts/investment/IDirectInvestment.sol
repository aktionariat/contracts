// SPDX-License-Identifier: MIT
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

import "../ERC20/IERC20.sol";

interface IDirectInvestment {
  function base() external view returns (IERC20);
  function token() external view returns (IERC20);
  function paymenthub() external view returns (address);

  function getBuyPrice(uint256 shares) external view returns (uint256);
  function processIncoming(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) external;

  error DirectInvestment_CryptoBuyingDisabled();
  error DirectInvestment_InvalidSettings();
  error DirectInvestment_NotPaymentHub(address sender);
  error DirectInvestment_InsufficientPayment(uint256 required, uint256 provided);
  error DirectInvestment_ArrayLengthMismatch();
}
