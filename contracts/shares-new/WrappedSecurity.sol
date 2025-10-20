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

import "./CO973dSecurity.sol";
import "./Recoverable.sol";
import "./Draggable.sol";
import "./Migratable.sol";
import "../ERC20/ERC20Allowlistable.sol";
import "../ERC20/IERC677Receiver.sol";
import "../ERC20/ERC20Named.sol";
import "../utils/SafeERC20.sol";

/**
 * @title CompanyName AG Shares SHA
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * This is an ERC-20 token representing share tokens of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 */
contract WrappedSecurity is ERC20Named, ERC20Allowlistable, Recoverable, Draggable, Migratable {
    
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

    error ContractBinding();
    error ContractNotBinding();
    error InvalidExpectedAmount();
    error TooManyDecimals();

    constructor(IERC20 base_, string memory _terms, uint8 _decimals, address _owner)
        ERC20Named(string.concat(base_.name(), " SHA"), string.concat(base_.symbol(), "S"), _decimals, _owner)
        ERC20Allowlistable()
        DeterrenceFee(0.01 ether) {
        base = base_;
        terms = _terms;
        if (base.decimals() > decimals) revert TooManyDecimals();
    }

    function baseToken() internal view override(Draggable, Migratable) returns (IERC20) {
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
     * Does not work if totalSupply is zero.
     */
    function mint(address recipient, uint256 amount) external {
        wrap(msg.sender, recipient, amount, convertToBase(amount));
    }

    /**
     * Wraps base shares into wrapped shares.
     */
    function mint(address recipient, uint256 amount, uint256 expectedWrappedAmount) external {
        if (totalSupply() > 0 && convertToBase(amount) != expectedWrappedAmount) revert InvalidExpectedAmount(); 
        wrap(msg.sender, recipient, amount, expectedWrappedAmount);
    }

    function wrap(address sender, address recipient, uint256 mintAmount, uint256 wrappedAmount) requireBinding internal {
        base.transferFrom(sender, address(this), wrappedAmount);
        _mint(recipient, mintAmount);
    }

    /**
     * Allow the base token to directly wrap newly minted tokens.
     * 
     * Only works as long as the contract is binding.
     * 
     * Assumes 1:1 wrapping factor with support for varying decimals.
     */
    function mintFromBase(address holder, uint256 baseTokens) requireBinding baseOnly external {
        wrap(holder, holder, baseTokens * 10 ** (decimals - base.decimals()), baseTokens);
    }

    function unwrap(uint256 amount) requireNonBinding external {
        // This is the amount of tokens that can be unwrapped when buring amount, rounded down
        uint256 unwrappedAmount = convertToBase(amount);
        // To unwrap 'unwrappedAmount' tokens, we only need to burn requiredBurn tokens.
        uint256 requiredBurn = unwrappedAmount * totalSupply() / base.balanceOf(address(this));
        assert(convertToBase(requiredBurn) == unwrappedAmount);
        _burn(owner, requiredBurn);
        base.transfer(owner, unwrappedAmount);
    }

    function convertToBase(uint256 amount) public view returns (uint256) {
        return amount * base.balanceOf(address(this)) / totalSupply();
    }

    /**
     * Replaces the base token.
     * 
     * Often done in combination with a termination.
     */
    function replaceBase(IERC20 wrapped_) internal override(Draggable, Migratable) {
        base = wrapped_;
        emit BaseTokenReplaced(base, wrapped_);
    }

    /**
     * Causes the contract to not be binding any more.
     * 
     * Henceforth, holders will be able to unwrap their tokens to get direct control of the
     * base token. The underlying token might be subject to their own terms. Terminating the
     * terms of this token does not invalidate the terms of underlying tokens.
     */
    function terminate() internal override(Draggable, Migratable) {
        binding = false;
        // Name should no longer imply that there is a shareholder agreement
        string memory newName = string.concat("Wrapped ", base.name());
        string memory newSymbol = string.concat("W", base.symbol());
        setNameInternal(newName, newSymbol);
        emit Terminated();
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
        if (binding) revert ContractBinding();
        _;
    }

    modifier requireNonBinding() {
        if (!binding) revert ContractNotBinding();
        _;
    }

}
