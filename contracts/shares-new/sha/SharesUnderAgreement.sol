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
pragma solidity >=0.8.0 <0.9.0;

import "../base/Recoverable.sol";
import "./DragAlong.sol";
import "./Modification.sol";
import "../../ERC20/ERC20Allowlistable.sol";
import "../../ERC20/ERC20Named.sol";
import "../../utils/SafeERC20.sol";

/**
 * @title CompanyName AG Shares SHA
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * This is an ERC-20 token representing share tokens of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 */
contract SharesUnderAgreement is ERC20Named, ERC20Allowlistable, Recoverable, DragAlong, Modification {

    using SafeERC20 for IERC20;

    // Version history:
    // 1: pre permit
    // 2: includes permit
    // 3: added permit2 allowance, VERSION field
    // 5 New token standard, skipping 4 to match base security version number
    uint8 public constant VERSION = 5;

    // Base security token
    IERC20 public base;

    /**
     * Indicates whether the terms are binding.
     * 
     * Once the terms cease to be binding, token holders are free to unwrap the token to gain
     * direct possession of the underlying base token.
     */ 
    bool public binding = true;

    /**
     * The url of the terms of this token.
     */
    string public terms;

    event ChangeTerms(string terms);
    event Terminated();
    event BaseTokenReplaced(IERC20 old, IERC20 neu);
    event Wrapped(address base, address sender, address recipient, uint256 amount);

    error ContractBinding();
    error ContractNotBinding();

    constructor(IERC20 base_, string memory _terms, uint8 _decimals, address _owner)
        ERC20Named(string.concat(base_.symbol(), "S"), string.concat(base_.name(), " SHA"), _decimals, _owner)
        ERC20Allowlistable()
        DeterrenceFee(0.01 ether) {
        base = base_;
        terms = _terms;
    }

    function baseToken() internal view override(DragAlong, Modification) returns (IERC20) {
        return base;
    }

    /**
     * The owner can change the URL where shareholders can find the terms.
     */
    function setTerms(string calldata _terms) external onlyOwner {
        terms = _terms;
        emit ChangeTerms(terms);
    }

    /**
     * Wraps base shares into wrapped shares.
     * 
     * Convenience method for wrap(msg.sender, amount)
     */
    function wrap(uint256 amount) external returns (uint256) {
        return wrap(msg.sender, msg.sender, amount);
    }

    /**
     * Wraps base shares into wrapped shares.
     * 
     * Wraps the given amount of base shares from the sender into wrapped shares for the recipient.
     * 
     * Requires the sender to have approved the transfer of the base shares to this contract.
     */
    function wrap(address recipient, uint256 amount) external returns (uint256) {
        return wrap(msg.sender, recipient, amount);
    }

    function wrap(address sender, address recipient, uint256 amount) requireBinding internal returns(uint256) {
        base.safeTransferFrom(sender, address(this), amount);
        _mint(recipient, amount);
        emit Wrapped(address(base), sender, recipient, amount);
        return amount;
    }

    /**
     * Allow the base token to directly wrap newly minted tokens.
     * 
     * Only works as long as the contract is binding.
     */
    function mintFromBase(address holder, uint256 baseTokens) requireBinding baseOnly public returns (uint256) {
        return wrap(holder, holder, baseTokens);
    }

    /**
     * Unwraps wrapped shares into base shares (rounded down if not exact).
     */
    function unwrap(uint256 amount) requireNonBinding external {
        uint256 baseAmount = convertToBase(amount); // rounds down
        _burn(msg.sender, amount);
        base.safeTransfer(msg.sender, baseAmount);
    }

    function convertToBase(uint256 amount) public view returns (uint256) {
        return amount * base.balanceOf(address(this)) / totalSupply();
    }

    /**
     * Replaces the base token.
     * 
     * Often done in combination with a termination.
     */
    function replaceBase(IERC20 wrapped_) internal override(DragAlong, Modification) {
        emit BaseTokenReplaced(base, wrapped_);
        base = wrapped_;
    }

    /**
     * Causes the contract to not be binding any more.
     * 
     * Henceforth, holders will be able to unwrap their tokens to get direct control of the
     * base token. The underlying token might be subject to their own terms. Terminating the
     * terms of this token does not invalidate the terms of underlying tokens.
     */
    function terminate() internal override(DragAlong, Modification) {
        binding = false;
        emit Terminated();
    }

    /**
     * Public defense against someone trying to recover tokens this contract holds.
     */
    function cancelBaseRecovery() external {
        IBaseToken(address(base)).cancelRecovery();
    }

    // Modifiers //

    /**
     * Allow only the base shares contract to call a function.
     */
    modifier baseOnly() {
        _checkSender(address(base));
        _;
    }

    modifier requireBinding() {
        if (!binding) revert ContractNotBinding();
        _;
    }

    modifier requireNonBinding() {
        if (binding) revert ContractBinding();
        _;
    }

}

interface IBaseToken {
    function cancelRecovery() external;
}
