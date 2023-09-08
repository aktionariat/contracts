// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./IUniswapV3.sol";
import "./Brokerbot.sol";
import "./PaymentHub.sol";
import "./BrokerbotRegistry.sol";
import "../ERC20/IERC677.sol";
import '../utils/Path.sol';

/**
 * @title Brokerbot Swap Router
 * @author Bernhard Ruf, bernhard@aktionariat.com 
 */ 
contract BrokerbotRouter is ISwapRouter {
	using Path for bytes;
	using SafeERC20 for IERC20;

  BrokerbotRegistry public immutable brokerbotRegistry;
	struct PaymentParams {
		IBrokerbot brokerbot;
		PaymentHub paymentHub;
		address baseToken;
		address shareToken;
		uint256 baseAmount;
		bytes path;
		bool hasMultiPools;
	}

	error Brokerbot_Swap_Failed();
	error Brokerbot_Deadline_Reached();
	error Brokerbot_Not_Found();

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
		IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), amountIn); // transfer base currency into this contract
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

	/**
	 * @notice Buy share tokens with any erc20 by given a uniswap routing path
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 * @return amountIn The amountIn actually spent.
	 */
	function exactOutput(ExactOutputParams calldata params) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
		PaymentParams memory paymentParams;
		paymentParams.hasMultiPools = params.path.hasMultiplePools();
		(address firstTokenIn, address firstTokenOut, uint24 fee) = params.path.decodeFirstPool();
		if (paymentParams.hasMultiPools) {
			paymentParams.path = params.path.skipLastToken();
			(paymentParams.baseToken, paymentParams.shareToken, fee) = params.path.getLastPool().decodeFirstPool();
		} else {
			paymentParams.baseToken = firstTokenIn;
			paymentParams.shareToken = firstTokenOut;
		}
		(paymentParams.brokerbot, paymentParams.paymentHub) = getBrokerbotAndPaymentHub(IERC20(paymentParams.baseToken), IERC20(paymentParams.shareToken));
		//amountIn = brokerbot.getBuyPrice(params.amountOut);
		IERC20(firstTokenIn).safeTransferFrom(msg.sender, address(this), params.amountInMaximum);
		if (IERC20(firstTokenIn).allowance(address(this), address(paymentParams.paymentHub)) == 0){
			// max is fine as the router shouldn't hold any funds, so this should be ever only needed to be set once per token/paymenthub
			IERC20(firstTokenIn).approve(address(paymentParams.paymentHub), type(uint256).max); 
		}
		// call paymenthub to buy shares with any erc20
		paymentParams.baseAmount = paymentParams.brokerbot.getBuyPrice(params.amountOut);
		(amountIn, ) = paymentParams.paymentHub.payFromERC20AndNotify(paymentParams.brokerbot, paymentParams.baseAmount, firstTokenIn, params.amountInMaximum, paymentParams.path, bytes("\x01"));
		IERC20(paymentParams.shareToken).safeTransfer(params.recipient, params.amountOut);
	}

	/**
	 * @notice Sell `amountIn` of share tokens for base currency.
	 * @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata.
	 * @return amountOut The amountOut actually received.
	 */
	function exactInputSingle(
		ExactInputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(params.tokenOut), IERC20(params.tokenIn));
		IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn); // transfer shares into this contract
		// send shares to brokerbot to sell them against base currency
		IERC677(params.tokenIn).transferAndCall(address(brokerbot), params.amountIn, bytes("\x01"));
		// transfer base currency to recipient
		amountOut = IERC20(params.tokenOut).balanceOf(address(this));
		IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
	}

  /**
	 * @notice Sell `amountIn` of share tokens for as much as possible of another along the specified path
   * @param params The parameters necessary for the multi-hop swap, encoded as `ExactInputParams` in calldata
   * @return amountOut The amount of the received token
	 */
	function exactInput(ExactInputParams calldata params) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {
		(address firstTokenIn, address firstTokenOut, uint24 fee) = params.path.decodeFirstPool();
		(IBrokerbot brokerbot, PaymentHub paymentHub) = getBrokerbotAndPaymentHub(IERC20(firstTokenOut), IERC20(firstTokenIn));
		IERC20(firstTokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn); // transfer shares into this contract
		amountOut = paymentHub.sellSharesAndSwap(brokerbot, IERC20(firstTokenIn), address(this), params.amountIn, bytes("\x01"), params, false);
	}

	function refundETH() external payable override {
		if(address(this).balance > 0) {
			(bool success, ) = msg.sender.call{value: address(this).balance}(new bytes(0));
			require(success, 'STE');
		}
	}

	function getBrokerbotAndPaymentHub(IERC20 base, IERC20 token) public view returns (IBrokerbot brokerbot, PaymentHub paymentHub) {
		brokerbot = brokerbotRegistry.getBrokerbot(base, token);
		if (address(brokerbot) == address(0)) revert Brokerbot_Not_Found();
    paymentHub = PaymentHub(payable(brokerbot.paymenthub()));
	}
}