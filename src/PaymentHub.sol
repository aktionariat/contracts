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
pragma solidity >=0.8;

import "./Address.sol";
import "./IERC20.sol";
import "./IUniswapV2.sol";
import "./ITokenReceiver.sol";

/**
 * A hub for payments. This allows tokens that do not support ERC 677 to enjoy similar functionality,
 * namely interacting with a token-handling smart contract in one transaction, without having to set an allowance first.
 * Instead, an allowance needs to be set only once, namely for this contract.
 * Further, it supports automatic conversion from Ether to the payment currency through Uniswap.
 */
contract PaymentHub {

    // immutable variables get integrated into the bytecode at deployment time, constants at compile time
    // Unlike normal variables, changing their values changes the codehash of a contract!
    IUniswapV2 constant uniswap = IUniswapV2(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IERC20 public immutable weth; 
    address public immutable currency;

    constructor(address currency_) {
        currency = currency_;
        weth = IERC20(uniswap.WETH());
    }

    function name() public view returns (string memory){
        return string(abi.encodePacked("Payment hub for ", IERC20(currency).name()));
    }

    function getPath() private view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(currency);
        return path;
    }

    function getPriceInEther(uint256 amountOfXCHF) public view returns (uint256) {
        return uniswap.getAmountsIn(amountOfXCHF, getPath())[0];
    }

    /**
     * Convenience method to swap ether and pay a target address
     */
    function makePaymentFromEther(address recipient, uint256 xchfamount) payable public {
        uniswap.swapETHForExactTokens{value: msg.value}(xchfamount, getPath(), recipient, block.timestamp);
        if (address(this).balance > 0){
            payable(msg.sender).transfer(address(this).balance); // return change
        }
    }

/*     function approveAndCall(address token, uint256 amount, address target, bytes calldata data, uint256 weiValue) public returns (bytes memory) {
        require((IERC20(token)).transferFrom(msg.sender, address(this), amount));
        require((IERC20(token)).approve(target, amount));
        return Address.functionCallWithValue(target, data, weiValue);
    } */

    // Allows to make a payment from the sender to an address given an allowance to this contract
    // Equivalent to xchf.transfer(recipient, xchfamount)
    function makePaymentAndNotify(address recipient, uint256 xchfamount, bytes calldata ref) public {
        makeTransferAndNotify(currency, recipient, xchfamount, ref);
    }

    function makeTransferAndNotify(address token, address recipient, uint256 amount, bytes calldata ref) public {
        require(IERC20(token).transferFrom(msg.sender, recipient, amount));
        ITokenReceiver(recipient).onTokenTransfer(token, msg.sender, amount, ref);
    }

    function makePaymentFromEtherAndNotify(address recipient, uint256 xchfamount, bytes calldata ref) payable public {
        makePaymentFromEther(recipient, xchfamount);
        ITokenReceiver(recipient).onTokenTransfer(address(currency), msg.sender, xchfamount, ref);
    }

    /**
     * In case tokens have been accidentally sent directly to this contract.
     * Make sure to be fast as anyone can call this!
     */
    function recover(address ercAddress, address to, uint256 amount) public {
        IERC20(ercAddress).transfer(to, amount);
    }

}