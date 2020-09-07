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

import "./IERC20.sol";
import "./IERC677Receiver.sol";
import "./IAutomaton.sol";

/**
 * @title CompanyName Shareholder Agreement
 * @author Luzius Meisser, luzius@meissereconomics.com
 * @dev These tokens are based on the ERC20 standard and the open-zeppelin library.
 *
 * Collects a performance fee when an investor sells shares.
 * Whether a performance fee is owed has to be determined off-chain.
 *
 * State: untested, initial concept!
 */
contract FeeCollector is IERC677Receiver {

    IAutomaton private automaton;
    address public recipient;
    uint256 public feeInBips;
    uint256 public acquisitionPrice;

    event FeeCollected(address indexed recipient, address indexed seller, address tokens, uint256 amountSold, address currency, uint256 price, uint256 fee);

    constructor(address automatonAddress, address recipient_, uint256 feeInBips_, uint256 acquisitionPrice_) {
        automaton = IAutomaton(automatonAddress);
        IERC20 shareToken = IERC20(automaton.token());
        shareToken.approve(automatonAddress, 10**50); // more than enough forever :)
        recipient = recipient_;
        feeInBips = feeInBips_;
        acquisitionPrice = acquisitionPrice_;
        require(feeInBips <= 10000);
    }

    function getAutomaton() public view returns (address) {
        return address(automaton);
    }

    // Sells amount shares through the automaton, collecting the performance fee.
    // Allowance must be given to this contract.
    function sell(uint256 shares) public returns (uint256) {
        require(IERC20(automaton.token()).transferFrom(msg.sender, address(this), shares));
        return processSale(msg.sender, shares);
    }

    // Sells amount shares through the automaton, collecting the performance fee.
    // This only works when using the "transferAndCall" method on the token contract.
    function onTokenTransfer(address from, uint256 amount, bytes calldata) override public {
        require(msg.sender == automaton.token());
        processSale(from, amount);
    }

    // Unwraps the shares of the user and automatically collects the fee.
    // Allowance must be given to this contract before calling this method.
    function unwrapDraggable(uint256 shares) public returns (uint256) {
        address tokenAddress = automaton.token();
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), shares);
        IDraggable draggable = IDraggable(tokenAddress);
        (address currency, uint256 unwrapped) = draggable.unwrap(shares);
        IERC20(currency).transfer(msg.sender, unwrapped);
        (uint256 proceeds, uint256 fee) = calculateFees(shares, unwrapped);
        emit FeeCollected(recipient, msg.sender, automaton.token(), shares, currency, proceeds, fee);
        return proceeds - fee;
    }

    function processSale(address seller, uint256 shares) internal returns (uint256){
        (uint256 grossProceeds, uint256 fee) = calculateFee(shares);
        uint256 netProceeds = automaton.sell(shares); // allowance was already set in constructor
        address currency = automaton.base();
        require(IERC20(currency).transfer(recipient, fee));
        require(IERC20(currency).transfer(seller, netProceeds - fee));
        emit FeeCollected(recipient, msg.sender, automaton.token(), shares, currency, grossProceeds, fee);
        return netProceeds - fee;
    }

    function calculateFee(uint256 shares) public view returns (uint256, uint256) {
        return calculateFees(shares, automaton.getSellPrice(shares));
    }

    function calculateFees(uint256 shares, uint256 proceeds) internal view returns (uint256, uint256) {
        uint256 acquisitionCost = shares * acquisitionPrice;
        if (proceeds >= acquisitionCost){
            return (proceeds, 0);
        } else {
            return (proceeds, proceeds * feeInBips / 10000);
        }
    }

}

abstract contract IDraggable {
    function unwrap(uint256 amount) virtual public returns (address, uint256);
}