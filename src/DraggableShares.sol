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

import "./recovery/ERC20Recoverable.sol";
import "./sha/ERC20Draggable.sol";

/**
 * @title Draggable CompanyName AG Shares
 * @author Luzius Meisser, luzius@aktionariat.com
 *
 * This is an ERC-20 token representing shares of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 * The shareholder agreement is partially enforced through this smart contract. The agreement
 * is designed to facilitate a complete acquisition of the firm even if a minority of shareholders
 * disagree with the acquisition, to protect the interest of the minority shareholders by requiring
 * the acquirer to offer the same conditions to everyone when acquiring the company, and to
 * facilitate an update of the shareholder agreement even if a minority of the shareholders that
 * are bound to this agreement disagree. The name "draggable" stems from the convention of calling
 * the right to drag a minority along with a sale of the company "drag-along" rights. The name is
 * chosen to ensure that token holders are aware that they are bound to such an agreement.
 *
 * The percentage of token holders that must agree with an update of the terms is defined by the
 * constant UPDATE_QUORUM. The percentage of yes-votes that is needed to successfully complete an
 * acquisition is defined in the constant ACQUISITION_QUORUM. Note that the update quorum is based
 * on the total number of tokens in circulation. In contrast, the acquisition quorum is based on the
 * number of votes cast during the voting period, not taking into account those who did not bother
 * to vote.
 */

contract DraggableShares is ERC20Recoverable, ERC20Draggable {

    string public terms;

    constructor(string memory _terms, address wrappedToken, uint256 quorumBps, uint256 votePeriodSeconds, address recoveryHub)
        ERC20Draggable(wrappedToken, quorumBps, votePeriodSeconds, recoveryHub) ERC20Flaggable(0) ERC20Recoverable(recoveryHub) {
        terms = _terms; // to update the terms, migrate to a new contract. That way it is ensured that the terms can only be updated when the quorom agrees.
    }

    function name() public override view returns (string memory){
        if (isBinding()){
            return string(abi.encodePacked(wrapped.name(), " SHA"));
        } else {
            return string(abi.encodePacked(wrapped.name(), " (Wrapped)"));
        }
    }

    function symbol() public override view returns (string memory){
        // ticker should be less dynamic than name
        return string(abi.encodePacked(wrapped.symbol(), "S"));
    }

    function transfer(address to, uint256 value) virtual override(ERC20Recoverable, ERC20Flaggable) public returns (bool) {
        return super.transfer(to, value);
    }

    /**
     * Let the oracle act as deleter of invalid claims. In earlier versions, this was referring to the claim deleter
     * of the wrapped token. But that stops working after a successful acquisition as the acquisition currency most
     * likely does not have a claim deleter.
     */
    function getClaimDeleter() public view override returns (address) {
        return getOracle();
    }

    function getCollateralRate(address collateralType) public view override returns (uint256) {
        uint256 rate = super.getCollateralRate(collateralType);
        if (rate > 0) {
            return rate;
        } else if (collateralType == address(wrapped)) {
            return unwrapConversionFactor;
        } else {
            // If the wrapped contract allows for a specific collateral, we should too.
            // If the wrapped contract is not IRecoverable, we will fail here, but would fail anyway.
            return IRecoverable(address(wrapped)).getCollateralRate(collateralType) * unwrapConversionFactor;
        }
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) virtual override(ERC20Draggable, ERC20Flaggable) internal {
        super._beforeTokenTransfer(from, to, amount);
    }

}