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

import "../ERC20/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../utils/Ownable.sol";
import "./IDirectInvestment.sol";
import "./IUniswapV3.sol";

/**
 * A hub for payments, to be used with the DirectInvestment contract. 
 * Enables a single allowance given to this contract to be used across multiple DirectInvestment contracts.
 * Separates payment process with possible swaps from the DirectInvestment settlement logic.
 * Handles paying with the base currency of the the DirectInvestment contract, or any other ERC20 token or ETH, by giving a Uniswap v3 swap path.
 * ETH payments are handled similar to WETH, by submitting the same path but sending msg.value instead of allowing WETH to be used.
 */

contract PaymentHub is Ownable {

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
    // Version 12: Cleanup and rewrite for DirectInvestment v10. Remove handling ETH refunds.

    uint256 public constant VERSION = 12;

    IQuoter private immutable uniswapV3Quoter;
    ISwapRouter private immutable uniswapV3SwapRouter;

    error PaymentHub_InvalidAmount();
    error PaymentHub_InvalidPath(IDirectInvestment directInvestment, IERC20 paymentCurrency, bytes path);

    constructor(address _owner, IQuoter _uniswapV3Quoter, ISwapRouter _uniswapV3SwapRouter) Ownable(_owner) {
        uniswapV3Quoter = _uniswapV3Quoter;
        uniswapV3SwapRouter = _uniswapV3SwapRouter;
    }

    /// @notice Quote the buy price in base currency for `amountShares`.
    function getPriceInBaseCurrency(IDirectInvestment directInvestment, uint256 amountShares) public view returns (uint256) {
        return directInvestment.getBuyPrice(amountShares);
    }

    /// @notice Quote the buy price for `amountShares` denominated in `paymentCurrency`.
    /// @dev Not view: routes through the Uniswap V3 quoter.
    function getPriceInPaymentCurrency(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, bytes calldata path) public returns (uint256) {
        checkPath(directInvestment, paymentCurrency, path);

        uint256 priceInBase = getPriceInBaseCurrency(directInvestment, amountShares);
        return uniswapV3Quoter.quoteExactOutput(path, priceInBase);
    }

    /// @notice Buy `amountShares` by paying directly in the base currency.
    /// @dev Caller must have approved this contract for the base currency.
    function payFromBaseCurrencyAndNotify(IDirectInvestment directInvestment, uint256 amountShares, bytes calldata ref) public {
        require(amountShares > 0, PaymentHub_InvalidAmount());

        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);

        directInvestment.base().safeTransferFrom(msg.sender, address(directInvestment), priceInBaseCurrency);
        directInvestment.processIncoming(msg.sender, amountShares, priceInBaseCurrency, ref);
    }

    /// @notice Buy `amountShares` by paying in any ERC20, swapped to base via Uniswap.
    /// @dev Caller must have approved this contract for `amountInMaximum` of `paymentCurrency`. Unused remainder is refunded.
    function payFromOtherCurrencyAndNotify(IDirectInvestment directInvestment, uint256 amountShares, IERC20 paymentCurrency, uint256 amountInMaximum, bytes calldata path, bytes calldata ref) public {
        require(amountShares > 0, PaymentHub_InvalidAmount());

        checkPath(directInvestment, paymentCurrency, path);
        
        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);
        
        paymentCurrency.safeTransferFrom(msg.sender, address(this), amountInMaximum);
        swapToBaseCurrencyAndPay(directInvestment, priceInBaseCurrency, paymentCurrency, amountInMaximum, path);
        directInvestment.processIncoming(msg.sender, amountShares, priceInBaseCurrency, ref);
    }

    /// @notice Buy `amountShares` by paying in ETH, wrapped to WETH and swapped to base via Uniswap.
    /// @dev Unused ETH is refunded as WETH.
    function payFromEtherAndNotify(IDirectInvestment directInvestment, uint256 amountShares, bytes calldata path, bytes calldata ref) public payable {
        require(amountShares > 0, PaymentHub_InvalidAmount());
        
        IWETH9 weth = IWETH9(uniswapV3Quoter.WETH9());
        checkPath(directInvestment, weth, path);

        uint256 priceInBaseCurrency = directInvestment.getBuyPrice(amountShares);

        weth.deposit{value: msg.value}();
        swapToBaseCurrencyAndPay(directInvestment, priceInBaseCurrency, weth, msg.value, path);
        directInvestment.processIncoming(msg.sender, amountShares, priceInBaseCurrency, ref);
    }

    /// @dev Validates a V3 exactOutput path: starts with base currency, ends with `paymentCurrency`.
    function checkPath(IDirectInvestment directInvestment, IERC20 paymentCurrency, bytes calldata path) internal view {
        require(path.length >= 43 && (path.length - 20) % 23 == 0, PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
        require(address(bytes20(path[0:20])) == address(directInvestment.base()), PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
        require(address(bytes20(path[path.length - 20:])) == address(paymentCurrency), PaymentHub_InvalidPath(directInvestment, paymentCurrency, path));
    }

    /// @dev Executes the exactOutput swap into `directInvestment` and refunds unused `paymentCurrency` to the caller.
    function swapToBaseCurrencyAndPay(IDirectInvestment directInvestment, uint256 amountBaseCurrency, IERC20 paymentCurrency, uint256 amountInMaximum, bytes memory path) internal {
        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: path,
                recipient: address(directInvestment),
                deadline: block.timestamp,
                amountOut: amountBaseCurrency,
                amountInMaximum: amountInMaximum
            });

        uint256 amountIn = uniswapV3SwapRouter.exactOutput(params);

        if (amountIn < amountInMaximum) {
            IERC20(paymentCurrency).safeTransfer(msg.sender, amountInMaximum - amountIn);
        }
    }

    /// @notice Grant infinite Uniswap allowance for the listed payment currencies. Must be called once per new currency.
    /// @dev Permissionless; the hub holds no token balance between transactions.
    function approvePaymentCurrencies(IERC20[] calldata erc20In) external {
        for (uint i=0; i<erc20In.length; i++) {
            approveERC20(erc20In[i]);
        }
    }

    /// @notice Grant infinite Uniswap allowance for a single payment currency.
    function approveERC20(IERC20 erc20In) public {
        IERC20(erc20In).approve(address(uniswapV3SwapRouter), type(uint256).max);
    }

    /// @notice Owner rescue for tokens accidentally sent to the hub.
    function withdrawToken(IERC20 tokenAddress, address to, uint256 amount) external onlyOwner {
        tokenAddress.safeTransfer(to, amount);
    }

    /// @notice Pay multiple recipients in one tx, e.g. for dividends. Unrelated to share purchases.
    function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
        for (uint i=0; i<recipients.length; i++) {
            IERC20(token).safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }
}
