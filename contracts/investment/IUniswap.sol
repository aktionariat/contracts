// SPDX-License-Identifier: MIT
// Trimmed to what PaymentHub uses. Sources:
// https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoterV2.sol
// https://github.com/Uniswap/universal-router/blob/2.1.2/contracts/interfaces/IUniversalRouter.sol
pragma solidity >=0.8.0 <0.9.0;

interface IQuoterV2 {
    /// @notice Input needed for an exact-output swap along `path` (encoded output first). Not a view: simulates and reverts internally, call it off-chain.
    function quoteExactOutput(bytes memory path, uint256 amountOut) external returns (uint256 amountIn, uint160[] memory sqrtPriceX96AfterList, uint32[] memory initializedTicksCrossedList, uint256 gasEstimate);

    // solhint-disable-next-line func-name-mixedcase
    function WETH9() external view returns (address);
}

interface IUniversalRouter {
    error TransactionDeadlinePassed();
    error V3TooMuchRequested(); // the swap needs more than amountInMaximum

    /// @notice Runs `commands` (one byte each) with the matching `inputs`; reverts after `deadline`.
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}
