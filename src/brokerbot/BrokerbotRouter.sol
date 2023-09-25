// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./IUniswapV3.sol";
import "./Brokerbot.sol";
import "./PaymentHub.sol";
import "./BrokerbotRegistry.sol";
import "../ERC20/IERC677.sol";
import "../utils/Path.sol";
import "../utils/BrokerbotLib.sol";
/**
 * @title Brokerbot Swap Router
 * @author Bernhard Ruf, bernhard@aktionariat.com 
 */ 
contract BrokerbotRouter is ISwapRouter {
	using Path for bytes;
	using SafeERC20 for IERC20;

    BrokerbotRegistry public immutable brokerbotRegistry;

	error Brokerbot_Deadline_Reached();

	constructor(BrokerbotRegistry _registry) {
		brokerbotRegistry = _registry;
	}

	modifier checkDeadline(uint256 deadline) {
	  if (deadline < block.timestamp) revert Brokerbot_Deadline_Reached();
    _;
  }

	// solhint-disable-next-line no-empty-blocks
	receive() external payable {
			// Important to receive ETH refund from PaymentHub
	}

	/**
	 * @notice Buy share tokens with base currency.
	 * @dev not usable to sell shares for excact output, as shares is not divisible (decimals is 0).
	 * @dev Single swap with ETH works, but base currency address has to be provided as tokenIn.
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 */
	function exactOutputSingle(
		ExactOutputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
		(IBrokerbot brokerbot, PaymentHub paymentHub) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(params.tokenIn), IERC20(params.tokenOut));
		if (msg.value > 0) {
			amountIn = _buyWithEther(brokerbot, paymentHub, params.amountOut, msg.value);
			refundETH();
		} else {
			amountIn = _exactOutputInternalPrepare(brokerbot, paymentHub, params.amountOut, params.amountInMaximum, IERC20(params.tokenIn));
			// call paymenthub to buy shares with base currency
			paymentHub.payAndNotify(brokerbot, amountIn,  bytes("\x01"));
			refundERC20(IERC20(params.tokenIn));
		}
		IERC20(params.tokenOut).safeTransfer(msg.sender, params.amountOut);
  }

	/**
	 * @notice Buy share tokens with any erc20 by given a uniswap routing path
	 * @dev If ETH is sent this function will try to swap ETH for share tokens directly and will ignore the path.
	 * @param params Params struct for swap. See @ISwapRouter for struct definition.
	 * @return amountIn The amountIn actually spent.
	 */
	function exactOutput(ExactOutputParams calldata params) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
		bytes memory modifiedPath = params.path;
		(address shareToken, address baseToken, ) = params.path.decodeFirstPool();
		(, address firstTokenIn, ) = params.path.getLastPool().decodeFirstPool();
		(IBrokerbot brokerbot, PaymentHub paymentHub) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(baseToken), IERC20(shareToken));
		if (msg.value > 0) {
			amountIn = _buyWithEther(brokerbot, paymentHub, params.amountOut, msg.value);
			refundETH();
		} else {
			amountIn = _exactOutputInternalPrepare(brokerbot, paymentHub, params.amountOut, params.amountInMaximum, IERC20(firstTokenIn));
			if (params.path.hasMultiplePools()) {
				modifiedPath = params.path.skipToken();
				(amountIn, ) = paymentHub.payFromERC20AndNotify(brokerbot, amountIn, firstTokenIn, params.amountInMaximum, modifiedPath, bytes("\x01"));
			} else {
				paymentHub.payAndNotify(brokerbot, params.amountInMaximum,  bytes("\x01"));
			}
			refundERC20(IERC20(firstTokenIn));
		}
		IERC20(shareToken).safeTransfer(params.recipient, params.amountOut);
	}

	/**
	 * @notice Sell `amountIn` of share tokens for base currency.
	 * @dev Only use it for selling shares, else there will be no brokerbot found. Output can't be ETH you have to swap WETH to ETH on your integration.
	 * @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata.
	 * @return amountOut The amountOut actually received.
	 */
	function exactInputSingle(
		ExactInputSingleParams calldata params
	) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {
		(IBrokerbot brokerbot,) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(params.tokenOut), IERC20(params.tokenIn));
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
		(address shareToken, address baseToken,) = params.path.decodeFirstPool();
		(IBrokerbot brokerbot, PaymentHub paymentHub) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(baseToken), IERC20(shareToken));

		IERC20(shareToken).safeTransferFrom(msg.sender, address(this), params.amountIn); // transfer shares into this contract
		if (IERC20(shareToken).allowance(address(this), address(paymentHub)) == 0){
			// max is fine as the router shouldn't hold any funds, so this should be ever only needed to be set once per token/paymenthub
			IERC20(shareToken).approve(address(paymentHub), type(uint256).max); 
		}
		if (params.path.hasMultiplePools()) {
			ExactInputParams memory modifiedParams = params;
			modifiedParams.path = params.path.skipToken();
			amountOut = paymentHub.sellSharesAndSwap(brokerbot, IERC20(shareToken), params.amountIn, bytes("\x01"), modifiedParams, false);
		} else {
			IERC677(shareToken).transferAndCall(address(brokerbot), params.amountIn, bytes("\x01"));
			// transfer base currency to recipient
			amountOut = IERC20(baseToken).balanceOf(address(this));
			IERC20(baseToken).safeTransfer(params.recipient, amountOut);
		}
	}

	/**
	 * @dev Remember to call this function if you make a swap with ETH.
	 */
	function refundETH() public payable override {
		if(address(this).balance > 0) {
			(bool success, ) = msg.sender.call{value: address(this).balance}(new bytes(0));
			require(success, 'STF');
		}
	}

	function refundERC20(IERC20 token) public {
		uint256 erc20Balance = token.balanceOf(address(this));
		if(erc20Balance > 0) {
			token.safeTransfer(msg.sender, erc20Balance);
		}
	}

	function _buyWithEther(IBrokerbot brokerbot, PaymentHub paymentHub, uint256 shareAmount, uint256 ethAmount) internal returns (uint256 amountIn) {
		uint256 baseAmount = brokerbot.getBuyPrice(shareAmount);
		(amountIn,) = paymentHub.payFromEtherAndNotify{value: ethAmount}(brokerbot, baseAmount, bytes("\x01"));	
    }

	function _exactOutputInternalPrepare(IBrokerbot brokerbot, PaymentHub paymentHub, uint256 amountShares, uint256 amountInMaximum, IERC20 tokenIn) internal  returns (uint256 amountIn) {
		amountIn = brokerbot.getBuyPrice(amountShares); // get current price, so nothing needs to be refunded
		tokenIn.transferFrom(msg.sender, address(this), amountInMaximum); // transfer base currency into this contract
        if (tokenIn.allowance(address(this), address(paymentHub)) == 0){
			// max is fine as the router shouldn't hold any funds, so this should be ever only needed to be set once per token/paymenthub
			tokenIn.approve(address(paymentHub), type(uint256).max); 
		}
	}

	function exactInputInternalPrepare(IBrokerbot brokerbot, PaymentHub paymentHub, uint256 amountShares, uint256 amountInMaximum, IERC20 tokenIn) internal  returns (uint256 amountIn) {
		
	}
}