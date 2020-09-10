// SPDX-License-Identifier: MIT
// Copied from https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/UniswapV2Router02.sol
pragma solidity >=0.7;

interface IUniswapV2 {

        function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
                external payable returns (uint[] memory amounts);

        function getAmountsIn(uint amountOut, address[] memory path)
                external view returns (uint[] memory amounts);

        function getAmountsOut(uint amountIn, address[] memory path)
                external view returns (uint[] memory amounts);

}