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

    address public immutable weth;
    
    IQuoter private constant UNISWAP_QUOTER = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
    ISwapRouter private constant UNISWAP_ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    AggregatorV3Interface internal immutable priceFeedCHFUSD;
    AggregatorV3Interface internal immutable priceFeedETHUSD;

    enum Currency { CHF, USD } 

    constructor(address _aggregatorCHFUSD, address _aggregatorETHUSD) {
        weth = UNISWAP_QUOTER.WETH9();
        priceFeedCHFUSD = AggregatorV3Interface(_aggregatorCHFUSD);
        priceFeedETHUSD = AggregatorV3Interface(_aggregatorETHUSD);
    }

    // Deprecated. Kept for compatibility with old hub
    function getPriceInEther(uint256 amountInBase) external returns (uint256) {
        return getPriceInEther(amountInBase, address(0));
    }

    /**
     * Get price in Ether depding on brokerbot setting.
     * If keep ETH is set price is from oracle.
     * This is the method that the Brokerbot widget should use to quote the price to the user.
     */
    function getPriceInEther(uint256 amountInBase, address brokerBot) public returns (uint256) {
        if ((brokerBot != address(0)) && hasSettingKeepEther(brokerBot)) {
            return getPriceInEtherFromOracle(amountInBase, brokerBot);
        } else {
            return UNISWAP_QUOTER.quoteExactOutputSingle(weth, IBrokerbot(brokerBot).base(), 3000, amountInBase, 0);
        }
    }

    /**
     * Price in ETH with 18 decimals
     */
    function getPriceInEtherFromOracle(uint256 amountInBase, address recipient) public view returns (uint256) {
        if(getBaseCurrency(recipient) == Currency.CHF) {
            return getPriceInUSD(amountInBase) * 10**8 / uint256(getLatestPriceETHUSD());
        }
        return amountInBase * 10**8 / uint256(getLatestPriceETHUSD());
    }

    /**
     * Price in USD with 18 decimals
     */
    function getPriceInUSD(uint256 amountInBase) public view returns (uint256) {
        return (uint256(getLatestPriceCHFUSD()) * amountInBase) / 10**8;
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
    function getLatestPriceCHFUSD() public view returns (int) {
        (, int price, , , ) = priceFeedCHFUSD.latestRoundData();
        return price;
    }

    /**
     * Convenience method to swap ether into currency and pay a target address
     */
    function payFromEther(address recipient, uint256 amountInBase) public payable {
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams(
            // rely on time stamp is ok, no exact time stamp needed
            // solhint-disable-next-line not-rely-on-time
            weth, IBrokerbot(recipient).base(), 3000, recipient, block.timestamp, amountInBase, msg.value, 0);

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        uint256 amountIn = UNISWAP_ROUTER.exactOutputSingle{value: msg.value}(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < msg.value) {
            UNISWAP_ROUTER.refundETH();
            payable(msg.sender).transfer(msg.value - amountIn); // return change
        }
    }

    function multiPay(address token, address[] calldata recipients, uint256[] calldata amounts) public {
        for (uint i=0; i<recipients.length; i++) {
            IERC20(token).transferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }

    /**
     * Can (at least in theory) save some gas as the sender balance only is touched in one transaction.
     */
    function multiPayAndNotify(address token, address[] calldata recipients, uint256[] calldata amounts, bytes calldata ref) external {
        for (uint i=0; i<recipients.length; i++) {
            payAndNotify(token, recipients[i], amounts[i], ref);
        }
    }

    // Allows to make a payment from the sender to an address given an allowance to this contract
    // Equivalent to xchf.transferAndCall(recipient, amountInBase)
    function payAndNotify(address recipient, uint256 amountInBase, bytes calldata ref) external {
        payAndNotify(IBrokerbot(recipient).base(), recipient, amountInBase, ref);
    }

    function payAndNotify(address token, address recipient, uint256 amount, bytes calldata ref) public {
        IERC20(token).transferFrom(msg.sender, recipient, amount);
        IBrokerbot(recipient).processIncoming(token, msg.sender, amount, ref);
    }

    function payFromEtherAndNotify(address recipient, uint256 amountInBase, bytes calldata ref) external payable {
        // Check if the brokerbot has setting to keep ETH
        if (hasSettingKeepEther(recipient)) {
            uint256 priceInEther = getPriceInEtherFromOracle(amountInBase, recipient);
            IBrokerbot(recipient).processIncoming{value: priceInEther}(address(IBrokerbot(recipient).base()), msg.sender, amountInBase, ref);

            // Pay back ETH that was overpaid
            if (priceInEther < msg.value) {
                payable(msg.sender).transfer(msg.value - priceInEther); // return change
            }

        } else {
            payFromEther(recipient, amountInBase);
            IBrokerbot(recipient).processIncoming(address(IBrokerbot(recipient).base()), msg.sender, amountInBase, ref);
        }
    }

    /**
     * Checks if the recipient(brokerbot) has setting enabled to keep ether
     */
    function hasSettingKeepEther(address recipient) public view returns (bool) {
        return IBrokerbot(recipient).settings() & 0x4 == 0x4;
    }

    function getBaseCurrency(address recipient) private view returns (Currency) {
        if (IBrokerbot(recipient).base() == address(0xB4272071eCAdd69d933AdcD19cA99fe80664fc08)) {
            return Currency.CHF;
        }
        return Currency.USD;
    }

    /**
     * In case tokens have been accidentally sent directly to this contract.
     * Make sure to be fast as anyone can call this!
     */
    function recover(address ercAddress, address to, uint256 amount) external {
        IERC20(ercAddress).transfer(to, amount);
    }

    // Important to receive ETH refund from Uniswap
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}