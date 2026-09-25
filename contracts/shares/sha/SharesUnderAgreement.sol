/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2026 Aktionariat AG (aktionariat.com)
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
pragma solidity >=0.8.0 <0.9.0;

import "../base/Recoverable.sol";
import "./DragAlong.sol";
import "./Modification.sol";
import "../../ERC20/ERC20Allowlistable.sol";
import "../../ERC20/ERC20Named.sol";

/**
 * @title CompanyName AG Shares SHA
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * This is an ERC-20 token representing share tokens of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 */
contract SharesUnderAgreement is ERC20Named, ERC20Allowlistable, Recoverable, DragAlong, Modification {

    // Version history:
    // 1: pre permit
    // 2: includes permit
    // 3: added permit2 allowance, VERSION field
    // 5 New token standard, skipping 4 to match base security version number
    // 6: assisted unwrap, wrapping mechanics moved to the Wrapping module
    uint8 public constant VERSION = 6;

    /**
     * The url of the terms of this token.
     */
    string public terms;

    /**
     * Indicates whether the terms are binding.
     * 
     * Once the terms cease to be binding, token holders are free to unwrap the token to gain
     * direct possession of the underlying base token. A wrapper never becomes binding again.
     */ 
    bool public binding = true;

    event ChangeTerms(string terms);
    event Terminated();

    constructor(IERC20 base_, string memory _terms, address _owner)
        ERC20Named(string.concat(base_.symbol(), symbolSuffix()), string.concat(base_.name(), nameSuffix()), 0, _owner)
        ERC20Allowlistable()
        DeterrenceFee(0.01 ether)
        Wrapping(base_) {
        terms = _terms;
    }

    /// @dev Appended to the base token's symbol and name. Overridden for participation certificates.
    function symbolSuffix() internal pure virtual returns (string memory) {
        return "S";
    }

    function nameSuffix() internal pure virtual returns (string memory) {
        return " SHA";
    }

    /**
     * The owner can change the URL where shareholders can find the terms, like on the base token.
     * The URL is a pointer; changing the agreement itself is a Modification subject to the veto period.
     */
    function setTerms(string calldata _terms) external onlyOwner {
        terms = _terms;
        emit ChangeTerms(terms);
    }

    function isBinding() internal view override returns (bool) {
        return binding;
    }

    /**
     * Causes the contract to not be binding any more.
     * 
     * Henceforth, holders will be able to unwrap their tokens to get direct control of the
     * base token. The underlying token might be subject to their own terms. Terminating the
     * terms of this token does not invalidate the terms of underlying tokens.
     */
    function terminate() internal override {
        binding = false;
        emit Terminated();
    }
}
