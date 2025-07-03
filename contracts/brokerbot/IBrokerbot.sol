// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../ERC20/IERC20.sol";
import "../ERC20/IERC20Permit.sol";

interface IBrokerbot {

	/*//////////////////////////////////////////////////////////////
                            Custom errors
  //////////////////////////////////////////////////////////////*/
  error Brokerbot_BuyingDisabled();
  error Brokerbot_SellingDisabled();
  /// Sender(msg.sender) has to be incoming token or paymenthub.
  /// @param sender The msg.sender.
  error Brokerbot_InvalidSender(address sender);
  /// target.call() wasn't successful.
  /// @param target The receiver of the Eth.
  /// @param amount The withdraw amount.
  error Brokerbot_WithdrawFailed(address target, uint256 amount);
  /// Sender(msg.sender) needs to be owner or paymenthub.
  /// @param sender The msg.sender.
  error Brokerbot_NotAuthorized(address sender);

  function paymenthub() external view returns (address);

  function base() external view returns (IERC20);

  function token() external view returns (IERC20Permit);
  
  function settings() external view returns (uint256);

  // @return The amount of shares bought on buying or how much in the base currency is transfered on selling
  function processIncoming(IERC20 token_, address from, uint256 amount, bytes calldata ref) external payable returns (uint256);

  function getBuyPrice(uint256 shares) external view returns (uint256);

  function getSellPrice(uint256 shares) external view returns (uint256);

}