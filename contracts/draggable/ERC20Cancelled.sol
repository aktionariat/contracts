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
pragma solidity 0.8.29;

import "../ERC20/ERC20Flaggable.sol";
import "../ERC20/IERC20.sol";
import "./ERC20Draggable.sol";

/**
 * 
 */

contract ERC20Cancelled is ERC20Flaggable {

    ERC20Draggable public immutable SHA;
    IShares public immutable BASE;

    constructor(address shaToken) ERC20Flaggable(0) {
        SHA = ERC20Draggable(shaToken);
        BASE = IShares(address(SHA.wrapped()));
    }

    function name() external view returns (string memory) {
        return string(abi.encodePacked("Cancelled ", BASE.name()));
    }

    function symbol() external view returns (string memory) {
        return string(abi.encodePacked("C", BASE.symbol()));
    }

    function burnThemAll() external {
        _mint(address(SHA), SHA.totalSupply());
        SHA.migrate();
        uint256 predecessorBalance = SHA.balanceOf(address(this));
        SHA.unwrap(predecessorBalance);
        _burn(address(this), predecessorBalance);
        // assert(predecessorSupply == totalSupply());
        BASE.burn(BASE.balanceOf(address(this)));
    }
}
