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

import "./ERC20Allowable.sol";
import "./DraggableShares.sol";

/**
 * @author Luzius Meisser, luzius@aktionariat.com
 */

contract AllowableDraggableShares is DraggableShares, ERC20Allowable {

    constructor(string memory _terms, address wrappedToken, uint256 quorumBps, uint256 votePeriodSeconds)
        DraggableShares(_terms, wrappedToken, quorumBps, votePeriodSeconds) {
    }

    function transfer(address to, uint256 value) override(DraggableShares, ERC20) public returns (bool) {
        return super.transfer(to, value);
    }

    function getAllowlistAdmin() internal override view returns (address) {
        return getClaimDeleter();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) virtual override(DraggableShares, ERC20Allowable) internal {
        super._beforeTokenTransfer(from, to, amount);
    }

}