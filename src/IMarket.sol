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

abstract contract IMarket {

    // Base ERC-20 token, e.g. XCHF
    function base() public virtual returns (address);

    // Traded token, e.g. some shares of a company
    function token() public virtual returns (address);

    // Current price in base units per traded token
    function getPrice() public virtual view returns (uint256);

    // Cost of buying shares shares in ether
    function getPriceInEther(uint256 shares) public virtual view returns (uint256);

    // Buy shares shares with Ether. The ETH will automatically be swapped into the base currency via uniswap
    function buyWithEther(uint256 shares) public virtual payable returns (uint256);

    // Buy shares with msg.sender as recipient
    function buy(uint256 numberOfSharesToBuy) public virtual returns (uint256);

    // Buy numberOfSharesToBuy shares and send them to recipient, paying with the base currency (allowance must be set)
    // For currencies that support the ERC-677, one can also send them directly to the Market, triggering a buy.
    function buy(address recipient, uint256 numberOfSharesToBuy) public virtual returns (uint256);

    // Sell shares with msg.sender as proceeds recipient
    function sell(uint256 tokens) public virtual returns (uint256);

    // Sell tokens shares and send the proceeds to recipient (allowance must be set)
    // For tokens that support the ERC-677, one can also send them directly to the Market, triggering a sell.
    function sell(address recipient, uint256 tokens) public virtual returns (uint256);

    // The fee that is charged when selling shares worth totalPrice
    function getSaleFee(uint256 totalPrice) public virtual view returns (uint256);

    // The amount of money a seller gets when selling shares shares (after deducting the fee)
    function getSaleProceeds(uint256 shares) public virtual view returns (uint256);

    // The amount of money a seller gets when selling shares shares (before deducting the fee)
    function getSellPrice(uint256 shares) public virtual view returns (uint256);

    // What it costs to buy shares shares in the base currency
    function getBuyPrice(uint256 shares) public virtual view returns (uint256);

    // How many shares one can by for money amount of the base currency
    function getShares(uint256 money) public virtual view returns (uint256);

}