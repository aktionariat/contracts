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
pragma solidity >=0.7;

import "./SafeMath.sol";
import "./Ownable.sol";
import "./Pausable.sol";
import "./IERC20.sol";
import "./IUniswapV2.sol";

contract Automaton is Ownable, Pausable {

    using SafeMath for uint256;

    address public base;  // ERC-20 currency
    address public token; // ERC-20 share token

    uint256 private price; // current price

    IUniswapV2 constant uniswap = IUniswapV2(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address constant weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    event Transaction(address who, int amount, address token, uint totPrice, uint fee, address base, uint price);

    constructor(address baseCurrency, address shareToken) {
        base = baseCurrency;
        token = shareToken;
    }

    function getPrice() public view returns (uint256) {
        return price;
    }

    function getPrice(uint256 shares) public view returns (uint256) {
        return price.mul(shares);
    }

    function setPrice(uint256 newPrice) public onlyOwner {
        price = newPrice;
    }

    function getPriceInEther(uint256 shares) public view returns (uint256) {
        uint256 totPrice = getPrice(shares);
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = base;
        return uniswap.getAmountsIn(totPrice, path)[0];
    }

    function buyWithEther(uint256 shares) public payable returns (uint256) {
        uint256 totPrice = getPrice(shares);
        uint256 totPriceEth = getPriceInEther(shares);
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = base;
        uint256[] memory amounts = uniswap.swapETHForExactTokens{value: totPriceEth}(totPrice, path, address(this), block.timestamp);
        assert(totPrice == amounts[1]);
        _buy(msg.sender, msg.sender, shares, amounts[1]);
        uint256 excessPayment = msg.value - totPriceEth;
        if (excessPayment > 0){
            msg.sender.transfer(excessPayment);
        }
        return amounts[0];
    }

    function buy(uint256 numberOfSharesToBuy) public returns (uint256) {
        return buy(msg.sender, numberOfSharesToBuy);
    }

    function buy(address recipient, uint256 numberOfSharesToBuy) public returns (uint256) {
        return _buy(msg.sender, recipient, numberOfSharesToBuy, 0);
    }

    function _buy(address paying, address recipient, uint256 shares, uint256 alreadyPaid) internal returns (uint256) {
        uint256 totPrice = getPrice(shares);
        IERC20 baseToken = IERC20(base);
        if (totPrice > alreadyPaid){
            require(baseToken.transferFrom(paying, address(this), totPrice - alreadyPaid));
        } else if (totPrice < alreadyPaid){
            // caller paid to much, return excess amount
            require(baseToken.transfer(paying, alreadyPaid - totPrice));
        }
        IERC20 shareToken = IERC20(token);
        require(shareToken.transfer(recipient, shares));
        emit Transaction(paying, int256(shares), token, totPrice, 0, base, price);
        return totPrice;
    }

    function withdraw(address to, uint256 amount) public onlyOwner() {
        IERC20 erc20 = IERC20(base);
        require(erc20.transfer(to, amount), "Transfer failed");
    }

    function withdrawETH(address payable to, uint256 amount) public onlyOwner() {
        to.transfer(amount);
    }
}