/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2022 Aktionariat AG (aktionariat.com)
*
* Permission is hereby granted to any person obtaining a copy of this software
* and associated documentation files (the "Software"), to deal in the Software
* without restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies of the
* Software, and to permit persons to whom the Software is furnished to do so,
* subject to the following conditions:
*
* - The above copyright notice and this permission notice shall be included in
*   all copies or substantial portions of the Software.
* - All automated license fee payments integrated into this and related Software
*   are preserved.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
pragma solidity ^0.8.0;

import "../utils/Address.sol";
import "../ERC20/IERC20.sol";
import "../ERC20/IERC20Permit.sol";
import "./IUniswapV3.sol";
import "../utils/Ownable.sol";
import "./IBrokerbot.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../utils/SafeERC20.sol";

/**
 * A hub for payments. This allows tokens that do not support ERC 677 to enjoy similar functionality,
 * namely interacting with a token-handling smart contract in one transaction, without having to set an allowance first.
 * Instead, an allowance needs to be set only once, namely for this contract.
 * Further, it supports automatic conversion from Ether to the payment currency through Uniswap or the reception of Ether
 * using the current exchange rate as found in the chainlink oracle.
 */
contract PaymentHub {

    using SafeERC20 for IERC20;

    // Version history
    // Version 4: added path to pay with any ecr20 via uniswap
    // Version 5: added sell via permit
    // Version 6: added transferEther function
    // Version 7: added sell against eth and erc20, version, add permitinfo/swapinfo struct
    // Version 8: use SafeERC20 for transfers
    uint8 public constant VERSION = 0x8;

    address public trustedForwarder;

    uint24 private constant DEFAULT_FEE = 3000;
    uint256 private constant DENOMINATOR = 1e8;
    address private constant CHF_TOKEN = 0xB4272071eCAdd69d933AdcD19cA99fe80664fc08;

    uint8 private constant KEEP_ETHER = 0x4; // copied from brokerbot
    
    IQuoter private immutable uniswapQuoter;
    ISwapRouter private immutable uniswapRouter;
    AggregatorV3Interface internal immutable priceFeedCHFUSD;
    AggregatorV3Interface internal immutable priceFeedETHUSD;

    struct PermitInfo {
        uint256 exFee;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // event to when new forwarder is set
    event ForwarderChanged(address indexed _oldForwarder, address indexed _newForwarder);

	/*//////////////////////////////////////////////////////////////
                            Custom errors
    //////////////////////////////////////////////////////////////*/
    /// Failguard when an erc20 transfer returns false. 
    error PaymentHub_TransferFailed();
    /// Sender not trusted.
    /// @param sender The msg.sender of this transaction.
    error PaymentHub_InvalidSender(address sender);
    /// swap with less base token as required.
    /// @param amountBase Required amount.
    /// @param swappedAmount Swapped amount.
    error PaymentHub_SwapError(uint256 amountBase, uint256 swappedAmount);

    constructor(address _trustedForwarder, IQuoter _quoter, ISwapRouter swapRouter, AggregatorV3Interface _aggregatorCHFUSD, AggregatorV3Interface _aggregatorETHUSD) {
        trustedForwarder = _trustedForwarder;
        uniswapQuoter = _quoter;
        uniswapRouter = swapRouter;
        priceFeedCHFUSD = _aggregatorCHFUSD;
        priceFeedETHUSD = _aggregatorETHUSD;
    }

    modifier onlySellerAndForwarder(address seller) {
        if (msg.sender != trustedForwarder && msg.sender != seller) {
            revert PaymentHub_InvalidSender(msg.sender);
        }
        _;
    }

    modifier onlyForwarder() {
        if (msg.sender != trustedForwarder) {
            revert PaymentHub_InvalidSender(msg.sender);
        }
        _;
    }

    /**
     * @notice Change the trusted forwarder.
     * @param newForwarder The new trusted forwarder.
     */
     function changeForwarder(address newForwarder) external onlyForwarder {
        trustedForwarder = newForwarder;
        emit ForwarderChanged(msg.sender, newForwarder);
    }

    /**  
     * Get price in ERC20
     * This is the method that the Brokerbot widget should use to quote the price to the user.
     * @param amountInBase The amount of the base currency for the exact output.
     * @param path The encoded path of the swap from erc20 to base.
     * @return amount quoted to pay
     */
    function getPriceInERC20(uint256 amountInBase, bytes memory path) public returns (uint256) {
        return getPriceERC20(amountInBase, path, true);
    }
    
    /**
     * @notice Get price for given amount and path swapped via uniswap. 
     * @param amount The exact amount which you want get out (exactOutput) or you put in (exactInput).
     * @param path The path of the swap (inreverse order for exactOutput).
     * @param exactOutput True if exactOutput should be used or false if exactInput should be used.
     */
    function getPriceERC20(uint256 amount, bytes memory path, bool exactOutput) public returns (uint256) {
        if (exactOutput) {
            return uniswapQuoter.quoteExactOutput(
                path,
                amount
            );
        } else {
            return uniswapQuoter.quoteExactInput(
                path,
                amount
            );
        }
    }

    /**
     * Get price in Ether depding on brokerbot setting.
     * If keep ETH is set price is from oracle.
     * This is the method that the Brokerbot widget should use to quote the price to the user.
     * @return The price in wei.
     */
    function getPriceInEther(uint256 amountInBase, IBrokerbot brokerBot) public returns (uint256) {
        if ((address(brokerBot) != address(0)) && hasSettingKeepEther(brokerBot)) {
            return getPriceInEtherFromOracle(amountInBase, IBrokerbot(brokerBot).base());
        } else {
            return uniswapQuoter.quoteExactOutputSingle(uniswapQuoter.WETH9(), address(brokerBot.base()), DEFAULT_FEE, amountInBase, 0);
        }
    }

    /**
     * Price in ETH with 18 decimals
     */
    function getPriceInEtherFromOracle(uint256 amountInBase, IERC20 base) public view returns (uint256) {
        if(address(base) == CHF_TOKEN) {
            return getLatestPriceCHFUSD() * amountInBase / getLatestPriceETHUSD();
        } else {
            return amountInBase * DENOMINATOR / getLatestPriceETHUSD();
        }
    }

    /**
     * Returns the latest price of eth/usd pair from chainlink with 8 decimals
     */
    function getLatestPriceETHUSD() public view returns (uint256) {
        (, int256 price, , , ) = priceFeedETHUSD.latestRoundData();
        return uint256(price);
    }

    /**
     * Returns the latest price of chf/usd pair from chainlink with 8 decimals
     */
    function getLatestPriceCHFUSD() public view returns (uint256) {
        (, int256 price, , , ) = priceFeedCHFUSD.latestRoundData();
        return uint256(price);
    }

    /**
     * Convenience method to swap ether into base and pay a target address
     */
    function payFromEther(address recipient, uint256 amountInBase, IERC20 base) public payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams(
            // rely on time stamp is ok, no exact time stamp needed
            // solhint-disable-next-line not-rely-on-time
            uniswapQuoter.WETH9(), address(base), DEFAULT_FEE, recipient, block.timestamp, amountInBase, msg.value, 0);

        ISwapRouter swapRouter = uniswapRouter;
        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutputSingle{value: msg.value}(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < msg.value) {
            swapRouter.refundETH();
            (bool success, ) = msg.sender.call{value:msg.value - amountIn}(""); // return change
            if (!success) {
                revert PaymentHub_TransferFailed();
            }
        }
    }

    /// @dev The calling address must approve this contract to spend its ERC20 for this function to succeed. As the amount of input ERC20 is variable,
    /// the calling address will need to approve for a slightly higher or infinit amount, anticipating some variance.
    /// @param amountOut The desired amount of baseCurrency.
    /// @param amountInMaximum The maximum amount of ERC20 willing to be swapped for the specified amountOut of baseCurrency.
    /// @param erc20In The address of the erc20 token to pay with.
    /// @param path The encoded path of the swap from erc20 to base.
    /// @param recipient The reciving address - brokerbot.
    /// @return amountIn The amountIn of ERC20 actually spent to receive the desired amountOut.
    function payFromERC20(uint256 amountOut, uint256 amountInMaximum, address erc20In, bytes memory path, address recipient) public returns (uint256 amountIn) {
        ISwapRouter swapRouter = uniswapRouter;
        // Transfer the specified `amountInMaximum` to this contract.
        IERC20(erc20In).safeTransferFrom(msg.sender, address(this), amountInMaximum);

        // The parameter path is encoded as (tokenOut, fee, tokenIn/tokenOut, fee, tokenIn)
        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: path,
                recipient: recipient,
                // solhint-disable-next-line not-rely-on-time
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });

        // Executes the swap, returning the amountIn actually spent.
        amountIn = swapRouter.exactOutput(params);

        // If the swap did not require the full amountInMaximum to achieve the exact amountOut then we refund msg.sender and approve the router to spend 0.
        if (amountIn < amountInMaximum) {
            IERC20(erc20In).safeTransfer(msg.sender, amountInMaximum - amountIn);
        }
    }

    ///This function appoves infinite allowance for Uniswap, this is safe as the paymenthub should never hold any token (see also recover() ).
    ///@dev This function needs to be called before using the PaymentHub the first time with a new ERC20 token.
    ///@param erc20In The erc20 addresse to approve.
    function approveERC20(address erc20In) external {
        IERC20(erc20In).approve(address(uniswapRouter), type(uint256).max);
    }

    function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
        for (uint i=0; i<recipients.length; i++) {
            IERC20(token).safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }

    /**
     * Can (at least in theory) save some gas as the sender balance only is touched in one transaction.
     */
    function multiPayAndNotify(IERC20 token, IBrokerbot[] calldata brokerbots, uint256[] calldata amounts, bytes calldata ref) external {
        for (uint i=0; i<brokerbots.length; i++) {
            payAndNotify(token, brokerbots[i], amounts[i], ref);
        }
    }

    /**
     * @notice Allows to make a base currency payment from the sender to the brokerbot, given an allowance to this contract.
     * @dev Equivalent to xchf.transferAndCall(brokerbot, amountInBase)
     * @param brokerbot The brokerbot to pay and receive the shares from.
     * @param amountInBase The amount of base currency used to buy shares.
     * @param ref The reference data blob.
     */
    function payAndNotify(IBrokerbot brokerbot, uint256 amountInBase, bytes calldata ref) external {
        payAndNotify(brokerbot.base(), brokerbot, amountInBase, ref);
    }

    function payAndNotify(IERC20 token, IBrokerbot brokerbot, uint256 amount, bytes calldata ref) public {
        token.safeTransferFrom(msg.sender, address(brokerbot), amount);
        brokerbot.processIncoming(token, msg.sender, amount, ref);
    }

    /**
     * @notice Pay with Ether to buy shares.
     * @param brokerbot The brokerbot to pay and receive the shares from.
     * @param amountInBase The amount of base currency used to buy shares.
     * @param ref The reference data blob.
     */
    function payFromEtherAndNotify(IBrokerbot brokerbot, uint256 amountInBase, bytes calldata ref) external payable {
        IERC20 base = brokerbot.base();
        // Check if the brokerbot has setting to keep ETH
        if (hasSettingKeepEther(brokerbot)) {
            uint256 priceInEther = getPriceInEtherFromOracle(amountInBase, base);
            brokerbot.processIncoming{value: priceInEther}(base, msg.sender, amountInBase, ref);

            // Pay back ETH that was overpaid
            if (priceInEther < msg.value) {
                (bool success, ) = msg.sender.call{value:msg.value - priceInEther}(""); // return change
                if (!success) {
                    revert PaymentHub_TransferFailed();
                }
            }

        } else {
            payFromEther(address(brokerbot), amountInBase, base);
            brokerbot.processIncoming(base, msg.sender, amountInBase, ref);
        }
    }

    /***
     * @notice Pay from any ERC20 token (which has Uniswapv3 ERC20-ETH pool) and send swapped base currency to brokerbot.
     * @notice The needed amount needs to be approved at the ERC20 contract beforehand
     * @param brokerbot The brokerbot to pay and receive the shares from.
     * @param amountBase The amount of base currency used to buy shares.
     * @param erc20 The address of the ERC20 token to pay.
     * @param amountInMaximum The maximum amount of the ERC20 to pay (should include some slippage).
     * @param path The encoded path of the swap from erc20 to base currency.
     * @param ref Reference data blob.
     * @return amountIn The amount erc20 spent to buy shares.
     * @return amountOut The amount of shares received by the brokerbot.
     */
    function payFromERC20AndNotify(IBrokerbot brokerbot, uint256 amountBase, address erc20, uint256 amountInMaximum, bytes memory path, bytes calldata ref) external returns (uint256 amountIn, uint256 amountOut) {
        IERC20 base = brokerbot.base();
        uint256 balanceBefore = IERC20(base).balanceOf(address(brokerbot));
        amountIn = payFromERC20(amountBase, amountInMaximum, erc20, path, address(brokerbot));
        uint256 balanceAfter = IERC20(base).balanceOf(address(brokerbot));
        if (amountBase != (balanceAfter - balanceBefore)) {
            revert PaymentHub_SwapError(amountBase, balanceAfter - balanceBefore);
        }        
        amountOut = brokerbot.processIncoming(base, msg.sender, balanceAfter - balanceBefore, ref);
    }

    /**
     * @notice Sell shares with permit
     * @param brokerbot The brokerbot to recive the shares.
     * @param seller The address of the seller.
     * @param recipient The address of the recipient of the sell preceeds.
     * @param amountToSell The amount the seller wants to sell.
     * @param ref Reference e.g. insider declaration and the type of sell.
     * @param permitInfo Information about the permit.
     * @return The base currency amount for the selling of the shares.
     */
    function sellSharesWithPermit(IBrokerbot brokerbot, IERC20Permit shares, address seller, address recipient, uint256 amountToSell, bytes calldata ref, PermitInfo calldata permitInfo) public onlySellerAndForwarder(seller) returns (uint256) {
        // Call permit to set allowance
        shares.permit(seller, address(this), amountToSell, permitInfo.deadline, permitInfo.v, permitInfo.r,permitInfo.s);
        // process sell
        if (permitInfo.exFee > 0){
            uint256 proceeds = _sellShares(brokerbot, shares, seller, address(this), amountToSell, ref);
            IERC20 currency = brokerbot.base();
            currency.safeTransfer(msg.sender, permitInfo.exFee);
            currency.safeTransfer(recipient, proceeds - permitInfo.exFee);
            return proceeds - permitInfo.exFee;
        } else {
            return _sellShares(brokerbot, shares, seller, recipient, amountToSell, ref);
        }
    }

    /**
     * @notice With this function a user can sell shares with permit and swap them to a desired token.
     * @param brokerbot The brokerbot of the shares to sell.
     * @param shares The (draggable)shares address.
     * @param seller The seller address.
     * @param amountToSell The amount of shares to sell.
     * @param ref Reference e.g. insider declaration and the type of sell.
     * @param permitInfo Information about the permit.
     * @param params Information about the swap.
     * @return The output amount of the swap to the desired token.
     */
    function sellSharesWithPermitAndSwap(IBrokerbot brokerbot, IERC20Permit shares, address seller,  uint256 amountToSell, bytes calldata ref, PermitInfo calldata permitInfo, ISwapRouter.ExactInputParams memory params, bool unwrapWeth) external onlySellerAndForwarder(seller) returns (uint256) {
        params.amountIn = sellSharesWithPermit(brokerbot, shares, seller, address(this), amountToSell, ref, permitInfo);
        return _swap(params, unwrapWeth);
    }

    /**
     * @notice With this function a user can sell shares and swap them to a desired token. The user has to approve the paymenthub before on the shares contract.
     * @param brokerbot The brokerbot of the shares to sell.
     * @param shares The (draggable)shares address.
     * @param amountToSell The amount of shares to sell.
     * @param ref Reference e.g. insider declaration and the type of sell.
     * @param params Information about the swap.
     * @return The output amount of the swap to the desired token.
     */
    function sellSharesAndSwap(IBrokerbot brokerbot, IERC20 shares, uint256 amountToSell,  bytes calldata ref, ISwapRouter.ExactInputParams memory params, bool unwrapWeth) external returns (uint256) {
        params.amountIn = _sellShares(brokerbot, shares, msg.sender, address(this), amountToSell, ref);
        return _swap(params, unwrapWeth);
    }

    /**
     * @notice Transfers shares to brokerbot and executes the selling.
     * @param brokerbot The brokerbot of the shares to sell.
     * @param shares The (draggable)shares address.
     * @param seller The seller address.
     * @param recipient The recipient of the base currency tokens. (this can be a 3rd party to off-ramp or the paymenthub itself if a swap will be done direct after)
     * @param amountToSell The amount of shares to sell.
     * @param ref Reference e.g. insider declaration and the type of sell.
     * @return The base currency amount for the selling of the shares.
     */ 
    function _sellShares(IBrokerbot brokerbot, IERC20 shares, address seller, address recipient, uint256 amountToSell, bytes calldata ref ) internal returns (uint256) {
        // send shares token to brokerbot
        shares.safeTransferFrom(seller, address(brokerbot), amountToSell);
        // process sell on brokerbot
        return brokerbot.processIncoming(shares, recipient, amountToSell, ref);
    }

    /**
     * @notice Swap (base currency) token according to given path and unwrap weth if needed.
     * @param params Information about the swap (includes path).
     * @return amountOut The output amount of the swap to the desired token.
     */
    function _swap(ISwapRouter.ExactInputParams memory params, bool unwrapWeth) internal returns(uint256 amountOut) {
        // if weth should be unwrapped, swap recipient is this contract and eth is send to seller
        if (unwrapWeth){
            address seller = params.recipient;
            params.recipient = address(this);
            amountOut = _swapToERC20(params);
            IWETH9(uniswapQuoter.WETH9()).withdraw(amountOut);
            (bool success, ) = payable(seller).call{value:amountOut}("");
            if (!success) revert PaymentHub_TransferFailed();
        } else {
            amountOut = _swapToERC20(params);
        }
    }

    /**
     * @notice Calls the Uniswap router to swap tokens according to given path.
     * @param params Information about the swap (includes path).
     * @return amountOut The output amount of the swap to the desired token.
     */
    function _swapToERC20(ISwapRouter.ExactInputParams memory params) internal returns(uint256 amountOut) {
        amountOut = uniswapRouter.exactInput(params);
        if (amountOut < params.amountOutMinimum){
            revert PaymentHub_SwapError(params.amountOutMinimum, amountOut);
        }
    }

    /**
     * Checks if the brokerbot has setting enabled to keep ether
     */
    function hasSettingKeepEther(IBrokerbot brokerbot) public view returns (bool) {
        return brokerbot.settings() & KEEP_ETHER == KEEP_ETHER;
    }

    /**
     * @notice In case tokens have been accidentally sent directly to this contract. Only Forwarder can withdraw, else a MEV bot will intercept it.
     * @param ercAddress The erc20 address.
     * @param to The address to transfer tokens to.
     * @param amount The amount of tokens to transfer.
     */
    function recover(IERC20 ercAddress, address to, uint256 amount) external onlyForwarder {
        ercAddress.safeTransfer(to, amount);
    }

    /**
     * @notice Transfer ether to a given address. Only Forwarder can withdraw, else a MEV bot will intercept it.
     * @param to The address to transfer ether to.
     */
    function withdrawEther(address to, uint256 amount) external onlyForwarder {
        (bool success, ) = payable(to).call{value:amount}("");
        if (!success) {
            revert PaymentHub_TransferFailed();
        }
    }

    /**
     * @notice Transfer ether to a given address.
     * @dev Used with the mutlisigwallet.
     * @param to The address to transfer ether to.
     */
    function transferEther(address to) external payable {
        (bool success, ) = payable(to).call{value:msg.value}("");
        if (!success) {
            revert PaymentHub_TransferFailed();
        }
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {
        // Important to receive ETH refund from Uniswap
    }
}
