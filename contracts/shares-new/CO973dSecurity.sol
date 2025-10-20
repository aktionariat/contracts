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

import "../ERC20/ERC20Named.sol";
import "../ERC20/ERC20Allowlistable.sol";
import "../ERC20/IERC677Receiver.sol";
import "./Recoverable.sol";
import "../shares/IShares.sol";
import "../utils/SafeERC20.sol";

/**
 * @title CompanyName AG Shares
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * These tokens represent ledger-based securities according to article 973d of the Swiss Code of Obligations.
 * This smart contract serves as an ownership registry, enabling the token holders to register them as
 * shareholders in the issuer's shareholder registry. This is equivalent to the traditional system
 * of having physical share certificates kept at home by the shareholders and a shareholder registry run by
 * the company. Just like with physical certificates, the owners of the tokens are the owners of the shares.
 * However, in order to exercise their rights (for example receive a dividend), shareholders must register
 * themselves. For example, in case the company pays out a dividend to a previous shareholder because
 * the current shareholder did not register, the company cannot be held liable for paying the dividend to
 * the "wrong" shareholder. In relation to the company, only the registered shareholders count as such.
 */
contract CO973dSecurity is IERC20, ERC20Named, ERC20Allowlistable, Recoverable {
    
    // Version history:
    // 1: everything before 2022-07-19
    // 2: added mintMany and mintManyAndCall, added VERSION field
    // 3: added permit
    // 4: refactor to custom errors, added allowance for permit2
    // 5: New base share class with CMTA compatibility
    uint8 public constant VERSION = 5;

    /**
     * A link to the registration agreement in accordance with the Swiss Code of Obligations, fulfilling the linking
     * requirement from article 973d paragraph 2 clause 3.
     * https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de#art_973_d
     */
    string public terms;

    /**
     * A reference to a successor token (if any), allowing the token holders to convert their tokens into successor tokens.
     * This can for example be useful to perform an upgrade of a token with additional functionality.
     */
    ISuccessorToken public successor; // the successor contract, if any

    event Announcement(string message);
    event ChangeTerms(string terms);
    event ChangeTotalShares(uint256 total);

    constructor(string memory _symbol, string memory _name, string memory _terms, address _owner)
        ERC20Named(_symbol, _name, 0, _owner)
        ERC20Allowlistable() 
        DeterrenceFee(0.01 ether) {
        terms = _terms;
    }

    function setTerms(string memory _terms) external onlyOwner {
        terms = _terms;
        emit ChangeTerms(_terms);
    }

    /**
     * Allows the issuer to make public announcements that are visible on chain.
     */
    function announcement(string calldata message) external onlyOwner {
        emit Announcement(message);
    }

    /**
     * Restricts the given addresses.
     *
     * To pause the whole contract, call this function with all addresses in use.
     *
     * In our experience, this function is never used. However, it is a requirement to fulfill the CMTA standard,
     * so we added it in a way that does not impose an overhead of 2000 gas on every transfer. Wiht our approach,
     * pausing and unpausing is more expensive, but total gas use should still be lower.
     */
    function pause(address[] calldata accounts) external onlyOwner {
        setType(accounts, TYPE_RESTRICTED);
    }

    /**
     * Unpauses accounts previously paused with the 'pause' function, resetting the
     * given addresses to the default type (e.g. TYPE_FREE).
     */
    function unpause(address[] calldata accounts, uint8 defaultType) external onlyOwner {
        setType(accounts, defaultType);
    }

    /**
     * Set a successor contract such that holders can migrate to a new version of this token.
     * 
     * The success must implement IERC677Receiver and mint new tokens to the sender when
     * receiving this token. Immediately after, the transferred tokens will be burned.
     */
    function setSuccessor(ISuccessorToken successor_) external onlyOwner {
        successor = successor_;
    }

    /**
     * Convenience function to migrate the full balance.
     */
    function migrate() external {
        migrate(balanceOf(msg.sender));
    }

    /**
     * Migrates a number of tokens to the successor contract and burns them there,
     * so the successor contract can mint new tokens for the user.
     *
     * The successor contract is set by the issuer and should represent a new version
     * of this token.
     *
     * Alternatively, the token holder can burn the token with the burn function, in
     * which case they are returned to the issuer, and then hope for the issuer to
     * mint a new token or other form of security as a replacement.
     */
    function migrate(uint256 amount) public {
        _transfer(msg.sender, address(successor), amount);
        _burn(address(successor), amount);
        ISuccessorToken(successor).notifyBurnedOnArrival(msg.sender, amount);
    }

    /**
     * Mint the indicated amount of share tokens.
     *
     * It is the responsibility of the issuer to ensure that all legal preconditions for the creation
     * of valid share tokens have been met before minting them.
     */
    function mint(address target, uint256 amount) public onlyOwner {
        _mint(target, amount);
    }

    function mintMany(address[] calldata target, uint256[] calldata amount) public onlyOwner {
        uint256 len = target.length;
        for (uint256 i = 0; i < len; i++) {
            _mint(target[i], amount[i]);
        }
    }

    function mintAndWrap(address shareholder, address wrapper, uint256 amount) public {
        mint(shareholder, amount);
        _approve(shareholder, wrapper, amount);
        IWrapper(wrapper).mintFromBase(shareholder, amount);
    }

    function mintAndWrapMany(address[] calldata target, address wrapper, uint256[] calldata amount) external {
        uint256 len = target.length;
        for (uint256 i = 0; i < len; i++) {
            mintAndWrap(target[i], wrapper, amount[i]);
        }
    }

    function _mint(address account, uint256 amount) internal virtual override {
        super._mint(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(ERC20Flaggable, ERC20Allowlistable) {
        ERC20Allowlistable._beforeTokenTransfer(from, to, amount);
    }

    function transfer(address to, uint256 value) public virtual override(ERC20Flaggable, IERC20) returns (bool) {
        return ERC20Flaggable.transfer(to, value);
    }

    /**
     * Transfers _amount tokens to the company and burns them.
     * The meaning of this operation depends on the circumstances and the fate of the shares does
     * not necessarily follow the fate of the tokens. For example, the company itself might call
     * this function to implement a formal decision to destroy some of the outstanding shares.
     * Also, this function might be called by an owner to return the shares to the company and
     * get them back in another form under an according agreement (e.g. printed certificates or
     * tokens on a different blockchain). It is not recommended to call this function without
     * having agreed with the company on the further fate of the shares in question.
     */
    function burn(uint256 _amount) external {
        _transfer(msg.sender, address(this), _amount);
        _burn(address(this), _amount);
    }
}

interface ISuccessorToken {
    function notifyBurnedOnArrival(address beneficiary, uint256 amount) external;
}

interface IWrapper {
    function mintFromBase(address holder, uint256 baseTokens) external;
}
