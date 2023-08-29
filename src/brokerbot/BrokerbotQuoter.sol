// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./IUniswapV3.sol";
/**
 * @title Brokerbot Swap Router
 * @author Bernhard Ruf, bernhard@aktionariat.com 
 */ 
contract BrokerbotQuoter is IQuoter {

  address private immutable weth;

  constructor(address _weth) {
    weth = _weth;
  }
	function quoteExactOutputSingle(
		address tokenIn,
		address tokenOut,
		uint24 fee,
		uint256 amountOut,
		uint160 sqrtPriceLimitX96
	) external override returns (uint256 amountIn) {}

	function quoteExactOutput(bytes memory path, uint256 amountOut) external override returns (uint256 amountIn) {}

	function quoteExactInput(bytes memory path, uint256 amountIn) external override returns (uint256 amountOut) {}

	function WETH9() external view override returns (address) {
    return weth;
  }
}