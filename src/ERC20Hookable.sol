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

/**
 * @title CompanyName Shareholder Agreement
 * @author Luzius Meisser, luzius@aktionariat.com
 * @dev These tokens are based on the ERC20 standard and the open-zeppelin library.
 *
 * This is an ERC-20 token representing shares of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'
 * of the 'DraggableCompanyNameShares' contract. The agreement is partially enforced
 * through the Swiss legal system, and partially enforced through this smart contract.
 * In particular, this smart contract implements a drag-along clause which allows the
 * majority of token holders to force the minority sell their shares along with them in
 * case of an acquisition. That's why the tokens are called "Draggable CompanyName AG Shares."
 */

import "./Ownable.sol";
import "./ERC20Flaggable.sol";
import "./ITransferHook.sol";

abstract contract ERC20Hookable is ERC20Flaggable, Ownable {

    address public hook;

    event HookSet(address hook);

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if (hook != address(0)){
            ITransferHook(hook).beforeTokenTransfer(from, to, amount);
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    function setHook(address _hook) public onlyOwner() {
        hook = _hook;
        emit HookSet(_hook);
    }

}