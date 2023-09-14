// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./IUniswapV3.sol";
import "../utils/Path.sol";
import "./BrokerbotRegistry.sol";
import "../utils/BrokerbotLib.sol";
/**
 * @title Brokerbot Swap Quoter
 * @author Bernhard Ruf, bernhard@aktionariat.com 
 */ 
contract BrokerbotQuoter is IQuoter {
	using Path for bytes;

  address private immutable weth;
	IQuoter private immutable uniswapQuoter;
	BrokerbotRegistry private immutable brokerbotRegistry;

  constructor(address _weth,  IQuoter _Quoter, BrokerbotRegistry _registry) {
    weth = _weth;
		uniswapQuoter = _Quoter;
		brokerbotRegistry = _registry;
  }

	/// @inheritdoc IQuoter
	/// @dev only used for buying shares with base currency
	function quoteExactOutputSingle(
		address tokenIn,
		address tokenOut,
		uint24 fee,
		uint256 amountOut,
		uint160 sqrtPriceLimitX96
	) external view override returns (uint256 amountIn) {
		(IBrokerbot brokerbot, ) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(tokenIn), IERC20(tokenOut));
		amountIn = brokerbot.getBuyPrice(amountOut);
	}

	/// @inheritdoc IQuoter
	function quoteExactOutput(bytes memory path, uint256 amountOut) external override returns (uint256 amountIn) {
		(address shareToken, address baseToken, ) = path.decodeFirstPool();
		(IBrokerbot brokerbot, ) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(baseToken), IERC20(shareToken));
		// get price from brokerbot
		amountIn = brokerbot.getBuyPrice(amountOut);
		if (path.hasMultiplePools()) {
			path = path.skipToken();
			amountIn = uniswapQuoter.quoteExactOutput(path, amountIn);
		}
	}

	/// @inheritdoc IQuoter
	function quoteExactInput(bytes memory path, uint256 amountIn) external override returns (uint256 amountOut) {
		(address shareToken, address baseToken, ) = path.decodeFirstPool();
		(IBrokerbot brokerbot, ) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(baseToken), IERC20(shareToken));
		amountOut = brokerbot.getSellPrice(amountIn);
		if (path.hasMultiplePools()) {
			path = path.skipToken();
			amountOut = uniswapQuoter.quoteExactInput(path, amountOut);
		}
	}

	/// @inheritdoc IQuoter
	/// @dev only used for selling shares for base currency
	function quoteExactInputSingle(
			address tokenIn,
			address tokenOut,
			uint24 fee,
			uint256 amountIn,
			uint160 sqrtPriceLimitX96
	) public view override returns (uint256 amountOut) {
		(IBrokerbot brokerbot, ) = BrokerbotLib.getBrokerbotAndPaymentHub(brokerbotRegistry, IERC20(tokenOut), IERC20(tokenIn));
		amountOut = brokerbot.getSellPrice(amountIn);
	}

	function WETH9() external view override returns (address) {
    return weth;
  }
}