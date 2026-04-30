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
pragma solidity >=0.8.0 <0.9.0;

import "../utils/Address.sol";
import "../ERC20/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../utils/Ownable.sol";
import "./IBrokerbot.sol";
import "./IUniswapV3.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * A hub for payments. This allows tokens that do not support ERC 677 to enjoy similar functionality,
 * namely interacting with a token-handling smart contract in one transaction, without having to set an allowance first.
 * Instead, an allowance needs to be set only once, namely for this contract.
 * Further, it supports automatic conversion from Ether to the payment currency through Uniswap or the reception of Ether
 * using the current exchange rate as found in the chainlink oracle.
 */
contract PaymentHub is Ownable, ReentrancyGuard {

    using SafeERC20 for IERC20;

    // Version History
    // Version 4: Added path to pay with any ERC20 via uniswap
    // Version 5: Added sell via permit
    // Version 6: Added transferEther function
    // Version 7: Added sell against ETH and ERC20, version, add permitinfo/swapinfo struct
    // Version 8: Use SafeERC20 for transfers
    // Version 9: Change payFromEther to include a swap path
    // Version 10: Added checkAmount to prevent underpayment of shares, removed keep ether
    // Version 11: Cleanup unused permit, remove selling, replace forwarder with owner

    uint256 public constant VERSION = 11;

    IQuoter private immutable uniswapV3Quoter;
    ISwapRouter private immutable uniswapV3SwapRouter;


	/*//////////////////////////////////////////////////////////////
                            Custom errors
    //////////////////////////////////////////////////////////////*/
    /// Failguard when an ERC20 transfer returns false. 
    error PaymentHub_TransferFailed();
    /// Sender not trusted.
    /// @param sender The msg.sender of this transaction.
    error PaymentHub_InvalidSender(address sender);
    /// Swap with less base token as required.
    /// @param amountBase Required amount.
    /// @param swappedAmount Swapped amount.
    error PaymentHub_SwapError(uint256 amountBase, uint256 swappedAmount);

    error InsufficientPayment(uint256 required, uint256 provided);

    constructor(address _owner, IQuoter _uniswapV3Quoter, ISwapRouter _uniswapV3SwapRouter) Ownable(_owner) {
        uniswapV3Quoter = _uniswapV3Quoter;
        uniswapV3SwapRouter = _uniswapV3SwapRouter;
    }

    // View functions for getting price

    function getPrice(IBrokerbot brokerbot, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path) public returns (uint256) {
        if (paymentCurrency == brokerbot.base()) {
            return getPriceInBaseCurrency(brokerbot, amountShares);
        } else {
            return getPriceInOtherCurrency(brokerbot, amountShares, paymentCurrency, path);
        }
    }

    function getPriceInBaseCurrency(IBrokerbot brokerbot, uint256 amountShares) public view returns (uint256) {
        return brokerbot.getBuyPrice(amountShares);
    }

    function getPriceInOtherCurrency(IBrokerbot brokerbot, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path) public returns (uint256) {
        uint256 priceInBase = getPriceInBaseCurrency(brokerbot, amountShares);
        checkPath(brokerbot, paymentCurrency, path);
        return uniswapV3Quoter.quoteExactOutput(path, priceInBase);
    }

    // Payment functions
    function payAndNotify(IBrokerbot brokerbot, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path, bytes calldata ref) external payable {
        uint256 priceInBaseCurrency = brokerbot.getBuyPrice(amountShares);

        if (paymentCurrency == brokerbot.base()) {
            payFromBaseCurrencyAndNotify(brokerbot, amountShares, priceInBaseCurrency, ref);
        } else {
            checkPath(brokerbot, paymentCurrency, path);
            payFromOtherCurrencyAndNotify(brokerbot, amountShares, priceInBaseCurrency, paymentCurrency, path, ref);
        }
    }

    // Transfer base tokens to the Brokerbot and call it to deliver shares.
    // Brokerbot will check that the amountBaseCurrency corresponds correctly to the amountShares and the current price, and revert if not.
    function payFromBaseCurrencyAndNotify(IBrokerbot brokerbot, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) public {
        brokerbot.base().safeTransferFrom(msg.sender, address(brokerbot), amountBaseCurrency);
        brokerbot.processIncoming(msg.sender, amountShares, amountBaseCurrency, ref);
    }

    function payFromOtherCurrencyAndNotify(IBrokerbot brokerbot, uint256 amountShares, uint256 amountBaseCurrency, IERC20 paymentCurrency, bytes calldata path, bytes calldata ref) public returns (uint256) {
        swapToBaseCurrencyAndPay(brokerbot, amountBaseCurrency, paymentCurrency, amountBaseCurrency, path);
        brokerbot.processIncoming(msg.sender, amountShares, amountBaseCurrency, ref);
    }

    // Check that the path is valid for given brokerbot, its base currency and given payment currency.
    function checkPath(IBrokerbot brokerbot, IERC20 paymentCurrency, bytes calldata path) internal view {
        require(path.length >= 43 && (path.length - 20) % 23 == 0, "Bad path");
        require(address(bytes20(path[0:20])) == address(paymentCurrency), "Wrong tokenIn");
        require(address(bytes20(path[path.length - 20:])) == address(brokerbot.base()), "Wrong tokenOut");
    }

    function swapToBaseCurrencyAndPay(IBrokerbot brokerbot, uint256 amountBaseCurrency, IERC20 paymentCurrency, uint256 amountInMaximum, bytes memory path) internal returns (uint256) {
        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: path,
                recipient: address(brokerbot),
                deadline: block.timestamp,
                amountOut: amountBaseCurrency,
                amountInMaximum: amountInMaximum
            });

        uint256 amountIn = uniswapV3SwapRouter.exactOutput(params);

        // If the swap did not require the full amountInMaximum to achieve the exact amountOut then we refund msg.sender
        if (amountIn < amountInMaximum) {
            if (msg.value > amountIn) {
                uniswapV3SwapRouter.refundETH();
                safeTransferETH(msg.sender, msg.value - amountIn);
            } else {
                IERC20(paymentCurrency).safeTransfer(msg.sender, amountInMaximum - amountIn);
            }
        }
    }

    function safeTransferETH(address recipient, uint256 amount) internal nonReentrant {
        (bool success, ) = recipient.call{value:amount}("");
        if (!success) {
            revert PaymentHub_TransferFailed();
        }
    }

    ///This function appoves infinite allowance for Uniswap, this is safe as the paymenthub should never hold any token (see also recover() ).
    ///@dev This function needs to be called before using the PaymentHub the first time with a new ERC20 token.
    ///@param erc20In The erc20 addresse to approve.
    function approveERC20(address erc20In) external {
        IERC20(erc20In).approve(address(uniswapV3SwapRouter), type(uint256).max);
    }

    // Withdraw tokens that were accidentally sent to this contract.
    function withdrawToken(IERC20 tokenAddress, address to, uint256 amount) external onlyOwner {
        tokenAddress.safeTransfer(to, amount);
    }

    // Withdraw ETH that were accidentally sent to this contract.
    function withdrawEther(address to, uint256 amount) external onlyOwner {
        safeTransferETH(to, amount);
    }

    // This has nothing to to with share payment. 
    // It is just a convenience function to allow the caller to make multiple payments in one transaction, e.g. for dividends.
    function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
        for (uint i=0; i<recipients.length; i++) {
            IERC20(token).safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {
        // Important to receive ETH refund from Uniswap
    }
}
