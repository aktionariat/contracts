/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* Proprietary License
*
* This code cannot be used without an explicit permission from the copyright holder.
* If you wish to use the Aktionariat Brokerbot, you can either use the open version
* named Brokerbot.sol that can be used under an MIT License with Automated License Fee Payments,
* or you can get in touch with use to negotiate a license to use LicensedBrokerbot.sol .
*
* Copyright (c) 2022 Aktionariat AG (aktionariat.com), All rights reserved.
*/
pragma solidity ^0.8.0;

import "./IUniswapV3.sol";
import "./Brokerbot.sol";
import "./PaymentHub.sol";
import "./BrokerbotRegistry.sol";
import "../ERC20/ERC20Flaggable.sol";

contract BrokerbotRouter is ISwapRouter {
  BrokerbotRegistry public immutable brokerbotRegistry;

	error Brokerbot_Swap_Failed();
	error Brokerbot_Deadline_Reached();

	constructor(BrokerbotRegistry _registry) {
		brokerbotRegistry = _registry;
	}

	modifier checkDeadline(uint256 deadline) {
		if (deadline < block.timestamp) revert Brokerbot_Deadline_Reached();
    _;
  }

	/**
	 * @notice Buy share tokens with base currency.
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 */
	function exactOutputSingle(
		ExactOutputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenIn), IERC20(params.tokenOut));
		// @TODO: check possiblity to not call buyprice here, as it get called again in brokerbot
		amountIn = brokerbot.getBuyPrice(params.amountOut); // get current price, so nothing needs to be refunded
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn); // transfer base currency into this contract
    if (IERC20(params.tokenIn).allowance(address(this), address(paymentHub)) == 0){
			// max is fine as the router shouldn't hold any funds, so this should be ever only needed to be set once per token/paymenthub
			IERC20(params.tokenIn).approve(address(paymentHub), type(uint256).max); 
		}
		// call paymenthub to buy shares with base currency
		paymentHub.payAndNotify(brokerbot, amountIn,  bytes("\x01"));
		// transfer bought shares to recipient
		if (!IERC20(params.tokenOut).transfer(params.recipient, params.amountOut)) {
			revert Brokerbot_Swap_Failed();
		}
  }

	function exactOutput(ExactOutputParams calldata params) external payable override returns (uint256 amountIn) {}

	/**
	 * @notice Sell share tokens for base currency.
	 * @param params Params struct for swap . See @ISwapRouter for struct definition.
	 */
	function exactInputSingle(
		ExactInputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenOut), IERC20(params.tokenIn));
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn); // transfer shares into this contract
		// send shares to brokerbot to sell them against base currency
		ERC20Flaggable(params.tokenIn).transferAndCall(address(brokerbot), params.amountIn, bytes("\x01"));
		// transfer base currency to recipient
		amountOut = IERC20(params.tokenOut).balanceOf(address(this));
		if (!IERC20(params.tokenOut).transfer(params.recipient, amountOut)) {
			revert Brokerbot_Swap_Failed();
		}
	}

	function exactInput(ExactInputParams calldata params) external payable override returns (uint256 amountOut) {}

	function refundETH() external payable override {}

	function getBrokerbotAndPaymentHub(IERC20 base, IERC20 token) public view returns (IBrokerbot brokerbot, PaymentHub paymentHub) {
		brokerbot = brokerbotRegistry.getBrokerbot(base, token);
    paymentHub = PaymentHub(payable(brokerbot.paymenthub()));
	}
}