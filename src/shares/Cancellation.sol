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

import "../draggable/IDraggable.sol";
import "../ERC20/IERC20.sol";
import "../ERC20/IBurnable.sol";

contract Cancellation {

    address public immutable target;
    address public immutable base;

    constructor(address target_) {
        target = target_;
        base = IDraggable(target).wrapped();
    }

    function burnThemAll() external {
        uint256 balance = IERC20(base).balanceOf(address(this));
        require(IERC20(base).totalSupply() == balance);
        IBurnable(base).burn(balance);
    }

    function name() external pure returns (string memory) {
        return "Cancelled Token";
    }

    function symbol() external pure returns (string memory) {
        return "---";
    }

    function migrate() external {
        IDraggable(target).migrate();
    }

    function balanceOf(address account) public view returns (uint256) {
        if (account == target){
            return IERC20(base).balanceOf(address(this));
        } else {
            return 0;
        }
    }

}