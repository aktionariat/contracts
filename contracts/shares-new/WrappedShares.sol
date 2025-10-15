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

import "./BaseShares.sol";
import "./Recoverable.sol";
import "./Draggable.sol";
import "./Migratable.sol";
import "../ERC20/ERC20Allowlistable.sol";
import "../ERC20/IERC677Receiver.sol";
import "../utils/SafeERC20.sol";

/**
 * @title CompanyName AG Shares SHA
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * This is an ERC-20 token representing share tokens of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 */
contract WrappedShares is IERC20, ERC20Allowlistable, Recoverable, Draggable, Migratable, IERC677Receiver {
    
    using SafeERC20 for IERC20;

    // Version history:
    // 1: pre permit
    // 2: includes permit
    // 3: added permit2 allowance, VERSION field
    // 5 New token standard, skipping 4 to match base security version number
    uint8 public constant VERSION = 5;

    // Base shares being wrapped and SHA terms
    IERC20 public base;

    bool public binding = true;

    string public terms;

    /// Event when the terms are changed with setTerms().
    event ChangeTerms(string terms);

    error ContractBinding();

    constructor(string memory _terms, uint8 _decimals, address _owner) ERC20Flaggable(_decimals) Ownable(_owner) ERC20Allowlistable() {
        terms = _terms;
    }

    /**
     * Current naming convention is to add the postfix "SHA" to the plain shares
     * to indicate that this token represents shares bound to a ShareHolder Agreement.
     */
    function name() public view override returns (string memory) {
        return string.concat(baseShares.name(), " SHA");
    }

    /**
     * Current naming convention is to append "S" to the base share ticker.
     */
    function symbol() public view override returns (string memory) {
        return string.concat(baseShares.symbol(), "S");
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
        _wrap(recipient, amount, convertToBase(amount));
    }

    /**
     * Wraps base shares into wrapped shares.
     */
    function mint(address recipient, uint256 amount, uint256 expectedWrappedAmount) external {
        if (totalSupply() > 0 && convertToBase(amount) != expectedWrappedAmount) revert InvalidExpectedAmount(); 
        wrap(recipient, amount, expectedWrappedAmount);
    }

    function wrap(address recipient, uint256 mintAmount, uint256 wrappedAmount) internal {
        wrapped.transferFrom(msg.sender, address(this), wrappedAmount);
        _mint(recipient, amount);
    }

    function unwrap(uint256 amount) external {
        if (binding) revert ContractBinding();
        // This is the amount of tokens that can be unwrapped when buring amount, rounded down
        uint256 unwrappedAmount = convertToBase(amount);
        // To unwrap 'unwrappedAmount' tokens, we only need to burn requiredBurn tokens.
        uint256 requiredBurn = unwrappedAmount * totalSupply() / wrapped.balanceOf(address(this));
        assert convertToBase(requiredBurn) == unwrappedAmount;
        _burn(owner, requiredBurn);
        wrapped.transfer(owner, unwrapped);
    }

    function convertToBase(uint256 amount) public returns (uint256) {
        return amount * wrapped.balanceOf(address(this)) / totalSupply();
    }

    /**
     * Function to be called by the base shares to wrap them.
     * The base shares must be IER677 compliant and call this function on transferAndCall.
     * Only the base shares contract is allowed to call this function.
     * The tokens are minted 1:1 to the sender of the base shares.
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata) external override onlyBaseShares returns (bool) {
        _mint(from, amount);
        return true;
    }

    function replaceBase(IERC20 wrapped_) internal override {
        wrapped = wrapped_;
        isBinding = false;
    }

    function _executeMigration(address successor) internal override {
        // Transfer this contracts baseShares to the successor contract
        // and get the same amount of the new token in return
        baseShares.approve(address(successor), baseShares.balanceOf(address(this)));
        successor.wrap(address(this), baseShares.balanceOf(address(this)));

        // Replace the token being wrapped to be the successor contract.
        // Normally, the successor contract should be wrapping the original baseShares.
        // Old WrappedToken --wraps--> New WrappedToken --wraps--> BaseShares
        // Therefore, users can manually unwrap to get the new WrappedToken, when needed.
        baseShares = IERC20(successor);
        isBinding = false;
    }

    // Modifiers //

    /**
     * Allow only the base shares contract to call a function.
     */
    modifier onlyBaseShares() {
        _checkSender(address(baseShares));
        _;
    }
}
