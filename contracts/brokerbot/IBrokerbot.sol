// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/IERC20.sol";

interface IBrokerbot {

	/*//////////////////////////////////////////////////////////////
                            Custom errors
  //////////////////////////////////////////////////////////////*/
  error Brokerbot_BuyingDisabled();

  /// Sender(msg.sender) has to be incoming token or paymenthub.
  /// @param sender The msg.sender.
  error Brokerbot_InvalidSender(address sender);

  /// Incoming token must be the base currency.
  error Brokerbot_InvalidBaseCurrency();

  /// Settings
  error Brokerbot_InvalidSettings();

  /// Sender(msg.sender) needs to be owner or paymenthub.
  /// @param sender The msg.sender.
  error Brokerbot_NotAuthorized(address sender);
  error Brokerbot_InsufficientPayment(uint256 required, uint256 provided);

  function base() external view returns (IERC20);
  function token() external view returns (IERC20);
  function paymenthub() external view returns (address);

  function getBuyPrice(uint256 shares) external view returns (uint256);
  function processIncoming(address buyer, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) external;
}
