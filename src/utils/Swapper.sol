// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../brokerbot/IUniswapV3.sol";
import "./SafeERC20.sol";
contract Swapper {
  using SafeERC20 for IERC20;

  uint256 public constant SLIPPAGE = 300;
  uint256 public constant FEE = 100;
  ISwapRouter public immutable uniswapRouter;
  IERC20 public immutable swapFrom;
  IERC20 public immutable swapTo;

  constructor(ISwapRouter _uniswapRouter, IERC20 _swapFrom, IERC20 _swapTo) {
    uniswapRouter = _uniswapRouter;
    swapFrom = _swapFrom;
    swapTo = _swapTo;
    IERC20(swapFrom).approve(address(uniswapRouter), type(uint256).max);
  }

  function swap(uint256 amount) external {
     swapFrom.safeTransferFrom(msg.sender, address(this), amount);
     uint256 amountOutMinimum = amount * (10000 - SLIPPAGE) / 10000;

     ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
       tokenIn: address(swapFrom),
       tokenOut: address(swapTo),
       fee: 100,
       recipient: msg.sender,
       deadline: block.timestamp,
       amountIn: amount,
       amountOutMinimum: amountOutMinimum,
       sqrtPriceLimitX96: 0
     });
     uniswapRouter.exactInputSingle(params);

  }
}
