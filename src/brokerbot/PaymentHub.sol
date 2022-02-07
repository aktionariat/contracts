/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2021 Aktionariat AG (aktionariat.com)
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
import "./IUniswapV3.sol";
import "../utils/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./IBrokerbot.sol";

/**
 * A hub for payments. This allows tokens that do not support ERC 677 to enjoy similar functionality,
 * namely interacting with a token-handling smart contract in one transaction, without having to set an allowance first.
 * Instead, an allowance needs to be set only once, namely for this contract.
 * Further, it supports automatic conversion from Ether to the payment currency through Uniswap or the reception of Ether
 * using the current exchange rate as found in the chainlink oracle.
 */
contract PaymentHub {
    uint24 private constant DEFAULT_FEE = 3000;
    uint256 private constant DENOMINATOR = 1e8;

    IERC20 public immutable currency;
    
    IQuoter private immutable uniswapQuoter;
    ISwapRouter private immutable uniswapRouter;
    AggregatorV3Interface internal priceFeedCHFUSD;
    AggregatorV3Interface internal priceFeedETHUSD;

    constructor(IERC20 _currency, IQuoter _quoter, ISwapRouter swapRouter, AggregatorV3Interface _aggregatorCHFUSD, AggregatorV3Interface _aggregatorETHUSD) {
        currency = _currency;
        uniswapQuoter = _quoter;
        uniswapRouter = swapRouter;
        priceFeedCHFUSD = _aggregatorCHFUSD;
        priceFeedETHUSD = _aggregatorETHUSD;
    }

    /**
     * Get price in Ether depding on brokerbot setting.
     * If keep ETH is set price is from oracle.
     * This is the method that the Brokerbot widget should use to quote the price to the user.
     * @return The price in wei.
     */
    function getPriceInEther(uint256 amountOfXCHF, IBrokerbot brokerBot) public returns (uint256) {
        if ((address(brokerBot) != address(0)) && hasSettingKeepEther(brokerBot)) {
            return getPriceInEtherFromOracle(amountOfXCHF);
        } else {
            return uniswapQuoter.quoteExactOutputSingle(uniswapQuoter.WETH9(), address(currency), DEFAULT_FEE, amountOfXCHF, 0);
        }
    }

    /**
     * Price in ETH with 18 decimals
     */
    function getPriceInEtherFromOracle(uint256 amountOfXCHF) public view returns (uint256) {
        return uint256(getLatestPriceCHFUSD()) * amountOfXCHF / uint256(getLatestPriceETHUSD());
    }

    /**
     * Price in USD with 18 decimals
     */
    function getPriceInUSD(uint256 amountOfCHF) public view returns (uint256) {
        return uint256(getLatestPriceCHFUSD()) * amountOfCHF / DENOMINATOR;
    }

    /**
     * Returns the latest price of eth/usd pair from chainlink with 8 decimals
     */
    function getLatestPriceETHUSD() public view returns (int256) {
        (, int256 price, , , ) = priceFeedETHUSD.latestRoundData();
        return price;
    }

    /**
     * Returns the latest price of chf/usd pair from chainlink with 8 decimals
     */
    function getLatestPriceCHFUSD() public view returns (int256) {
        (, int256 price, , , ) = priceFeedCHFUSD.latestRoundData();
        return price;
    }

    /**
     * Convenience method to swap ether into currency and pay a target address
     */
    function payFromEther(address recipient, uint256 xchfamount) public payable {
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams(
            // rely on time stamp is ok, no exact time stamp needed
            // solhint-disable-next-line not-rely-on-time
            uniswapQuoter.WETH9(), address(currency), DEFAULT_FEE, recipient, block.timestamp, xchfamount, msg.value, 0);

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        uint256 amountIn = uniswapRouter.exactOutputSingle{value: msg.value}(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < msg.value) {
            uniswapRouter.refundETH();
            (bool success, ) = msg.sender.call{value:msg.value - amountIn}(""); // return change
            require(success, "Transfer failed.");            
        }
    }

    function multiPay(address[] calldata recipients, uint256[] calldata amounts) external {
        multiPay(currency, recipients, amounts);
    }

    function multiPay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) public {
        for (uint i=0; i<recipients.length; i++) {
            IERC20(token).transferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }

    /**
     * Can (at least in theory) save some gas as the sender balance only is touched in one transaction.
     */
    function multiPayAndNotify(IERC20 token, address[] calldata recipients, uint256[] calldata amounts, bytes calldata ref) external {
        for (uint i=0; i<recipients.length; i++) {
            payAndNotify(token, recipients[i], amounts[i], ref);
        }
    }

    // Allows to make a payment from the sender to an address given an allowance to this contract
    // Equivalent to xchf.transferAndCall(recipient, xchfamount)
    function payAndNotify(address recipient, uint256 xchfamount, bytes calldata ref) external {
        payAndNotify(currency, recipient, xchfamount, ref);
    }

    function payAndNotify(IERC20 token, address recipient, uint256 amount, bytes calldata ref) public {
        IERC20(token).transferFrom(msg.sender, recipient, amount);
        IBrokerbot(recipient).processIncoming(token, msg.sender, amount, ref);
    }

    function payFromEtherAndNotify(address recipient, uint256 xchfamount, bytes calldata ref) external payable {
        // Check if the brokerbot has setting to keep ETH
        if (hasSettingKeepEther(IBrokerbot(recipient))) {
            uint256 priceInEther = getPriceInEtherFromOracle(xchfamount);
            IBrokerbot(recipient).processIncoming{value: priceInEther}(currency, msg.sender, xchfamount, ref);

            // Pay back ETH that was overpaid
            if (priceInEther < msg.value) {
                (bool success, ) = msg.sender.call{value:msg.value - priceInEther}(""); // return change
                require(success, "Transfer failed.");
            }

        } else {
            payFromEther(recipient, xchfamount);
            IBrokerbot(recipient).processIncoming(currency, msg.sender, xchfamount, ref);
        }
    }

    /**
     * Checks if the recipient(brokerbot) has setting enabled to keep ether
     */
    function hasSettingKeepEther(IBrokerbot recipient) public view returns (bool) {
        return recipient.settings() & recipient.KEEP_ETHER() == recipient.KEEP_ETHER();
    }

    /**
     * In case tokens have been accidentally sent directly to this contract.
     * Make sure to be fast as anyone can call this!
     */
    function recover(address ercAddress, address to, uint256 amount) external {
        IERC20(ercAddress).transfer(to, amount);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {
        // Important to receive ETH refund from Uniswap
    }
}