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

	error BrokerbotSwap_Failed();

	constructor(BrokerbotRegistry _registry) {
		brokerbotRegistry = _registry;
	}

	/**
	 * @notice Buy share tokens with base currency
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 */
	function exactOutputSingle(
		ExactOutputSingleParams calldata params
	) external payable override returns (uint256 amountIn) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenIn), IERC20(params.tokenOut));
		// @TODO: check possiblity to not call buyprice here, as it get called again in brokerbot
		amountIn = brokerbot.getBuyPrice(params.amountOut); // get current price, so nothing needs to be refunded
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn);
    IERC20(params.tokenIn).approve(address(paymentHub), amountIn);
		paymentHub.payAndNotify( brokerbot, amountIn,  bytes("\x01"));
    IERC20(params.tokenIn).approve(address(paymentHub), 0);
		// transfer to recipient
		if (!IERC20(params.tokenOut).transfer(params.recipient, params.amountOut)) {
			revert BrokerbotSwap_Failed();
		}
  }

	function exactOutput(ExactOutputParams calldata params) external payable override returns (uint256 amountIn) {}

	function exactInputSingle(
		ExactInputSingleParams calldata params
	) external payable override returns (uint256 amountOut) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenOut), IERC20(params.tokenIn));
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
		IERC20(params.tokenIn).approve(address(paymentHub), type(uint256).max);
		ERC20Flaggable(params.tokenIn).transferAndCall(address(brokerbot), params.amountIn, bytes("\x01"));
		// transfer to recipient
		amountOut = IERC20(params.tokenOut).balanceOf(address(this));
		if (!IERC20(params.tokenOut).transfer(params.recipient, amountOut)) {
			revert BrokerbotSwap_Failed();
		}
	}

	function exactInput(ExactInputParams calldata params) external payable override returns (uint256 amountOut) {}

	function refundETH() external payable override {}

	function getBrokerbotAndPaymentHub(IERC20 base, IERC20 token) public view returns (IBrokerbot brokerbot, PaymentHub paymentHub) {
		brokerbot = brokerbotRegistry.getBrokerbot(base, token);
    paymentHub = PaymentHub(payable(brokerbot.paymenthub()));
	}
}