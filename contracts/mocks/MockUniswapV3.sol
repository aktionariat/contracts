// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {IERC20} from "../ERC20/IERC20.sol";
import {IQuoter, ISwapRouter} from "../investment/IUniswapV3.sol";

/// @notice Quotes swaps at a fixed rate: amountIn = amountOut * numerator / denominator (rounded up).
contract MockUniswapV3Quoter is IQuoter {
    uint256 public immutable numerator;
    uint256 public immutable denominator;
    address public immutable weth9;

    constructor(uint256 numerator_, uint256 denominator_, address weth9_) {
        require(numerator_ > 0 && denominator_ > 0);
        numerator = numerator_;
        denominator = denominator_;
        weth9 = weth9_;
    }

    function quoteExactOutput(bytes calldata path, uint256 amountOut) external view returns (uint256) {
        _validatePathLayout(path);
        return _quote(amountOut);
    }

    function quoteExactOutputSingle(address, address, uint24, uint256 amountOut, uint160) external view returns (uint256) {
        return _quote(amountOut);
    }

    function quoteExactInput(bytes calldata path, uint256 amountIn) external view returns (uint256) {
        _validatePathLayout(path);
        return _quoteInverse(amountIn);
    }

    function quoteExactInputSingle(address, address, uint24, uint256 amountIn, uint160) external view returns (uint256) {
        return _quoteInverse(amountIn);
    }

    function WETH9() external view returns (address) {
        return weth9;
    }

    function _validatePathLayout(bytes calldata path) internal pure {
        require(path.length >= 43 && (path.length - 20) % 23 == 0);
    }

    function _quote(uint256 amountOut) internal view returns (uint256) {
        return (amountOut * numerator + denominator - 1) / denominator;
    }

    function _quoteInverse(uint256 amountIn) internal view returns (uint256) {
        return (amountIn * denominator + numerator - 1) / numerator;
    }
}

/// @notice Executes exactOutput swaps by pulling tokenIn from the caller and pushing tokenOut to the recipient.
/// @dev tokenIn/tokenOut are decoded from the path: it starts with tokenOut and ends with tokenIn.
contract MockUniswapV3Router is ISwapRouter {
    MockUniswapV3Quoter public immutable quoter;

    constructor(MockUniswapV3Quoter quoter_) {
        quoter = quoter_;
    }

    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn) {
        amountIn = quoter.quoteExactOutput(params.path, params.amountOut);

        IERC20 tokenOut = IERC20(address(bytes20(params.path[0:20])));
        IERC20 tokenIn = IERC20(address(bytes20(params.path[params.path.length - 20:])));

        require(tokenIn.transferFrom(msg.sender, address(this), amountIn));
        require(tokenOut.transfer(params.recipient, params.amountOut));
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn) {
        amountIn = quoter.quoteExactOutputSingle(
            params.tokenIn,
            params.tokenOut,
            params.fee,
            params.amountOut,
            params.sqrtPriceLimitX96
        );
        require(IERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn));
        require(IERC20(params.tokenOut).transfer(params.recipient, params.amountOut));
    }

    function exactInput(ExactInputParams calldata) external payable returns (uint256) {
        revert("MockUniswapV3Router: exactInput not supported");
    }

    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256) {
        revert("MockUniswapV3Router: exactInputSingle not supported");
    }

    function refundETH() external payable {}
}
