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
import "./IDirectInvestment.sol";
import "./IUniswapV3.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * A hub for payments, to be used with the DirectInvestment contract. 
 * Enables a single allowance given to this contract to be used across multiple DirectInvestment contracts.
 * Separates payment process with possible swaps from the DirectInvestment settlement logic.
 * Handles paying with the base currency of the the DirectInvestment contract, or any other ERC20 token or ETH, by giving a Uniswap v3 swap path.
 * ETH payments are handled similar to WETH, by submitting the same path but sending msg.value instead of allowing WETH to be used.
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

    error PaymentHub_InvalidPath(IDirectInvestment directInvestment, IERC20 paymentCurrency, bytes calldata path);
    error PaymentHub_TransferFailed();

    constructor(address _owner, IQuoter _uniswapV3Quoter, ISwapRouter _uniswapV3SwapRouter) Ownable(_owner) {
        uniswapV3Quoter = _uniswapV3Quoter;
        uniswapV3SwapRouter = _uniswapV3SwapRouter;
    }

    // View functions for getting price

    function getPrice(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path) public returns (uint256) {
        if (paymentCurrency == directInvestment.base()) {
            return getPriceInBaseCurrency(directInvestment, amountShares);
        } else {
            return getPriceInOtherCurrency(directInvestment, amountShares, paymentCurrency, path);
        }
    }

    function getPriceInBaseCurrency(IDirectInvestment directInvestment, uint256 amountShares) public view returns (uint256) {
        return directInvestment.getBuyPrice(amountShares);
    }

    function getPriceInOtherCurrency(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path) public returns (uint256) {
        uint256 priceInBase = getPriceInBaseCurrency(directInvestment, amountShares);
        checkPath(directInvestment, paymentCurrency, path);
        return uniswapV3Quoter.quoteExactOutput(path, priceInBase);
    }

    // Payment functions
    function payAndNotify(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path, bytes calldata ref) external payable {
        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);

        if (paymentCurrency == directInvestment.base()) {
            payFromBaseCurrencyAndNotify(directInvestment, amountShares, priceInBaseCurrency, ref);
        } else {
            checkPath(directInvestment, paymentCurrency, path);
            payFromOtherCurrencyAndNotify(directInvestment, amountShares, priceInBaseCurrency, paymentCurrency, path, ref);
        }
    }

    // Transfer base tokens to the DirectInvestment contract and call it to deliver shares.
    // DirectInvestment contract will check that the amountBaseCurrency corresponds correctly to the amountShares and the current price, and revert if not.
    function payFromBaseCurrencyAndNotify(IDirectInvestment directInvestment, uint256 amountShares, uint256 amountBaseCurrency, bytes calldata ref) public {
        directInvestment.base().safeTransferFrom(msg.sender, address(directInvestment), amountBaseCurrency);
        directInvestment.processIncoming(msg.sender, amountShares, amountBaseCurrency, ref);
    }

    function payFromOtherCurrencyAndNotify(IDirectInvestment directInvestment, uint256 amountShares, uint256 amountBaseCurrency, IERC20 paymentCurrency, bytes calldata path, bytes calldata ref) public returns (uint256) {
        swapToBaseCurrencyAndPay(directInvestment, amountBaseCurrency, paymentCurrency, amountBaseCurrency, path);
        directInvestment.processIncoming(msg.sender, amountShares, amountBaseCurrency, ref);
    }

    // Check that the path is valid for given DirectInvestment contract, its base currency and given payment currency.
    function checkPath(IDirectInvestment directInvestment, IERC20 paymentCurrency, bytes calldata path) internal view {
        require(path.length >= 43 && (path.length - 20) % 23 == 0, PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
        require(address(bytes20(path[0:20])) == address(paymentCurrency), PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
        require(address(bytes20(path[path.length - 20:])) == address(directInvestment.base()), PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
    }

    function swapToBaseCurrencyAndPay(IDirectInvestment directInvestment, uint256 amountBaseCurrency, IERC20 paymentCurrency, uint256 amountInMaximum, bytes memory path) internal returns (uint256) {
        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: path,
                recipient: address(directInvestment),
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
