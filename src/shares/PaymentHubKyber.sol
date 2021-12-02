/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2020 Aktionariat AG (aktionariat.com)
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
import "../interfaces/IUniswapV3.sol";
import "../interfaces/ITokenReceiver.sol";
import "../utils/Ownable.sol";
import "../interfaces/kyber/IDMMRouter02.sol";
import "../interfaces/kyber/IDMMFactory.sol";

/**
 * A hub for payments. This allows tokens that do not support ERC 677 to enjoy similar functionality,
 * namely interacting with a token-handling smart contract in one transaction, without having to set an allowance first.
 * Instead, an allowance needs to be set only once, namely for this contract.
 * Further, it supports automatic conversion from Ether to the payment currency through Uniswap.
 */
contract PaymentHubKyber {

    IDMMRouter02 public dmmRouter;

    address public immutable currency;

    constructor(address _currency, IDMMRouter02 _dmmRouter) {
        dmmRouter = _dmmRouter;
        currency = _currency;
    }

    function getPoolPath(IERC20 currencyIn, IERC20 currencyOut) private view returns (address[] memory){
        IDMMFactory dmmFactory = IDMMFactory(dmmRouter.factory());
        address poolAddress = dmmFactory.getUnamplifiedPool(currencyIn, currencyOut);
        // use unamplified pool
        address[] memory poolsPath = new address[](1);
        poolsPath[0] = poolAddress;
        return poolsPath;
    }

    function getPath() private view returns (IERC20[] memory)  {
        IERC20[] memory path = new IERC20[](2);
        path[0] = dmmRouter.weth();
        path[1] = IERC20(currency);
        return path;
    }

    function getPriceInEther(uint256 amountOfBaseCurrency) public view returns (uint256[] memory amounts) {
        IERC20[] memory path = getPath();
        address[] memory poolsPath = getPoolPath(dmmRouter.weth(), IERC20(currency));

        return dmmRouter.getAmountsIn(amountOfBaseCurrency, poolsPath, path);
    }

    /**
     * Convenience method to swap ether into currency and pay a target address
     */
    function payFromEther(address recipient, uint256 baseCurrencyAmount) payable public {
        IERC20 weth = dmmRouter.weth();
        uint256[] memory amountIn = getPriceInEther(baseCurrencyAmount);
        // transfer ETH to contract to use for swap
        require(weth.transferFrom(msg.sender, address(this), amountIn[0]), 'transferFrom failed');

        // approve dmmRouter to use ETH
        require(weth.approve(address(dmmRouter), amountIn[0]), 'approve failed');

        // swap tokens
        uint[] memory amounts = dmmRouter.swapTokensForExactTokens(
            baseCurrencyAmount,
            amountIn[0],
            getPoolPath(weth, IERC20(currency)),
            getPath(),
            recipient,
            block.timestamp
        );
    }

    function multiPay(address[] calldata recipients, uint256[] calldata amounts) external {
        multiPay(currency, recipients, amounts);
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
    // Equivalent to xchf.transferAndCall(recipient, xchfamount)
    function payAndNotify(address recipient, uint256 baseCurrencyAmount, bytes calldata ref) external {
        payAndNotify(currency, recipient, baseCurrencyAmount, ref);
    }

    function payAndNotify(address token, address recipient, uint256 amount, bytes calldata ref) public {
        IERC20(token).transferFrom(msg.sender, recipient, amount);
        ITokenReceiver(recipient).onTokenTransfer(token, msg.sender, amount, ref);
    }

    function payFromEtherAndNotify(address recipient, uint256 baseCurrencyAmount, bytes calldata ref) payable external {
        //payFromEther(recipient, baseCurrencyAmount);
        ITokenReceiver(recipient).onTokenTransfer(address(currency), msg.sender, baseCurrencyAmount, ref);
    }

    /**
     * In case tokens have been accidentally sent directly to this contract.
     * Make sure to be fast as anyone can call this!
     */
    function recover(address ercAddress, address to, uint256 amount) external {
        IERC20(ercAddress).transfer(to, amount);
    }

    // Important to receive ETH refund from Uniswap
    receive() payable external {}
}