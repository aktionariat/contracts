// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

//import '../utils/SafeERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
contract ExampleTrades {
    //using SafeERC20 for IERC20; 
    ISwapRouter public immutable brokerbotRouter;
    //IERC20 public constant BASE_TOKEN = IERC20(0xB4272071eCAdd69d933AdcD19cA99fe80664fc08); //XCHF
    address public constant BASE_TOKEN = 0xB4272071eCAdd69d933AdcD19cA99fe80664fc08; //XCHF
    //IERC20 public constant SHARE_TOKEN = IERC20(0x6f38e0f1a73c96cB3f42598613EA3474F09cB200); // DAKS
    address public constant SHARE_TOKEN = 0x6f38e0f1a73c96cB3f42598613EA3474F09cB200; // DAKS
//    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    //IERC20 public constant WETH9 = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public constant WETH9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // For this example, we will set the pool fee to 0.3%.
    uint24 public constant poolFee = 3000;
    
    constructor(ISwapRouter _brokerbotRouter) {
        brokerbotRouter = _brokerbotRouter;
    }
    /// @notice buySharesDirect trades a minimum possible amount of XCHF for a fixed amount of shares.
    /// @dev The calling address must approve this contract to spend its XCHF for this function to succeed. As the amount of input XCHF is variable,
    /// the calling address will need to approve for a slightly higher amount, anticipating some variance.
    /// @param amountOut The exact amount of shares to receive on this trade
    /// @param amountInMaximum The amount of XCHF we are willing to spend to receive the specified amount of shares.
    /// @return amountIn The amount of XCHF actually spent in the trade.
    function buySharesDirect(uint256 amountOut, uint256 amountInMaximum) external returns (uint256 amountIn) {
        // Transfer the specified amount of base currency tokens (XCHF) to this contract.
        console.log(amountInMaximum);
        //uint256 allowanceB = BASE_TOKEN.allowance(msg.sender, address(this));
        //console.log(allowanceB);
        TransferHelper.safeTransferFrom(BASE_TOKEN, msg.sender, address(this), amountInMaximum);

        // Approve the router to spend the specified `amountInMaximum` of base currency tokens (XCHF).
        // In production, you should choose the maximum amount to spend based on oracles or other data sources to achieve a better swap.
        //BASE_TOKEN.approve(address(brokerbotRouter), amountInMaximum);
        TransferHelper.safeApprove(BASE_TOKEN, address(brokerbotRouter), amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: address(BASE_TOKEN),
                tokenOut: address(SHARE_TOKEN),
                fee: 0,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });
        // Executes trade returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = brokerbotRouter.exactOutputSingle(params);
        // For exact output trades, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < amountInMaximum) {
            //BASE_TOKEN.approve(address(brokerbotRouter), 0);
            TransferHelper.safeApprove(BASE_TOKEN, address(brokerbotRouter), 0);
            TransferHelper.safeTransfer(BASE_TOKEN, msg.sender, amountInMaximum - amountIn);
        }
    }
    
    /// @notice sellSharesDirect trades a fixed amount of shares for a maximum possible amount of base currency tokens
    /// by calling `exactInputSingle` in the brokerbot router.
    /// @dev The calling address must approve this contract to spend at least `amountIn` worth of its share token for this function to succeed.
    /// @param amountIn The exact amount of share tokens that will be swapped for base currency tokens (XCHF).
    /// @return amountOut The amount of base currecny tokens (XCHF) received.
    function sellSharesDirect(uint256 amountIn) external returns (uint256 amountOut) {
        // msg.sender must approve this contract

        // Transfer the specified amount of share tokens (DAKS) to this contract.
        TransferHelper.safeTransferFrom(SHARE_TOKEN, msg.sender, address(this), amountIn);

        // Approve the router to spend share tokens (DAKS).
        //SHARE_TOKEN.approve(address(brokerbotRouter), amountIn);
                TransferHelper.safeApprove(SHARE_TOKEN, address(brokerbotRouter), amountIn);
        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source, like the brokerbot quoter, to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(SHARE_TOKEN),
                tokenOut: address(BASE_TOKEN),
                fee: 0,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        amountOut = brokerbotRouter.exactInputSingle(params);
    }

    /// @notice buySharesMultihop trades a minimum possible amount of token in  for a fixed amount of shares.
    /// @dev The calling address must approve this contract to spend its token in for this function to succeed. As the amount of input XCHF is variable,
    /// the calling address will need to approve for a slightly higher amount, anticipating some variance.
    /// @param amountOut The exact amount of shares to receive on this trade
    /// @param amountInMaximum The amount of tokeni in we are willing to spend to receive the specified amount of shares.
    /// @return amountIn The amount of token in actually spent in the trade.
    function buySharesMultihop(uint256 amountOut, uint256 amountInMaximum) external returns (uint256 amountIn) {
        // Transfer the specified amount of base currency tokens (XCHF) to this contract.
        TransferHelper.safeTransferFrom(USDC, msg.sender, address(this), amountInMaximum);

        // Approve the router to spend the specified `amountInMaximum` of token in (USDC in this example)
        // In production, you should choose the maximum amount to spend based on oracles or other data sources to achieve a better swap.
        //USDC.approve(address(brokerbotRouter), amountInMaximum);
        TransferHelper.safeApprove(USDC, address(brokerbotRouter), amountInMaximum);
        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: abi.encodePacked(SHARE_TOKEN, uint24(0), BASE_TOKEN, poolFee, USDC),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });
        // Executes trade returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = brokerbotRouter.exactOutput(params);
        // For exact output trades, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(USDC, address(brokerbotRouter), 0);
            TransferHelper.safeTransfer(USDC, msg.sender, amountInMaximum - amountIn);
        }
    }
/*
    /// @notice buySharesMultihopEther trades a minimum possible amount of token in  for a fixed amount of shares.
    /// @dev The calling address must approve this contract to spend its token in for this function to succeed. As the amount of input XCHF is variable,
    /// the calling address will need to approve for a slightly higher amount, anticipating some variance.
    /// @param amountOut The exact amount of shares to receive on this trade
    /// @param amountInMaximum The amount of tokeni in we are willing to spend to receive the specified amount of shares.
    /// @return amountIn The amount of token in actually spent in the trade.
    function buySharesMultihopEther(uint256 amountOut, uint256 amountInMaximum) external returns (uint256 amountIn) {
        // Transfer the specified amount of base currency tokens (XCHF) to this contract.
        USDC.safeTransferFrom(msg.sender, address(this), amountInMaximum);

        // Approve the router to spend the specified `amountInMaximum` of token in (USDC in this example)
        // In production, you should choose the maximum amount to spend based on oracles or other data sources to achieve a better swap.
        USDC.approve(address(brokerbotRouter), amountInMaximum);
        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: abi.encodePacked(SHARE_TOKEN, uint24(0), BASE_TOKEN, poolFee, USDC),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });
        // Executes trade returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = brokerbotRouter.exactOutput(params);
        // For exact output trades, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < amountInMaximum) {
            USDC.approve(address(brokerbotRouter), 0);
            USDC.safeTransfer(msg.sender, amountInMaximum - amountIn);
        }
    }*/


}