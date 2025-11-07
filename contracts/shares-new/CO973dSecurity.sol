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
 * And just like with physical certificates, rightful ownership is proven by demonstrating possession of the
 * token. In order to exercise their rights (for example receive a dividend), shareholders must register
 * themselves. For example, in case the company pays out a dividend to a previous shareholder because
 * the current shareholder did not register, the company cannot be held liable for paying the dividend to
 * the "wrong" shareholder. In relation to the company, only the registered shareholders count as such.
 * 
 * The presence of a function in this contract does not imply that the corresponding action is also legally
 * permissible. The intended use of the contract functionality is defined in the accompanying registration agreement.
 * In particular, the issuer must not use any administrative functions in violation of the registration agreement.
 */
contract CO973dSecurity is IERC20, ERC20Named, ERC20Allowlistable, Recoverable {

    // Version history:
    // 1: everything before 2022-07-19
    // 2: added mintMany and mintManyAndCall, added VERSION field
    // 3: added permit
    // 4: refactor to custom errors, added allowance for permit2
    // 5: Complete revistion, CMTA compatibility
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

    constructor(string memory _symbol, string memory _name, string memory _terms, address _owner) ERC20Named(_symbol, _name, 0, _owner) ERC20Allowlistable() DeterrenceFee(0.01 ether) {
        terms = _terms;
    }

    /**
     * Updates the link to the registration agreement.
     */
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
     * Can be used to pause the contract when called with all addresses that are currently in use as an argument.
     */
    function pause(address[] calldata accounts) external onlyOwner {
        setType(accounts, TYPE_RESTRICTED);
    }

    /**
     * Unpauses accounts previously paused with the 'pause' function, resetting the given addresses to the given default type (e.g. TYPE_FREE).
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
     * 
     * See migrate(uint256 amount) for more information.
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

    /**
     * Mints tokens to multiple addresses in one transaction.
     * 
     * See mint for more information.
     */
    function mintMany(address[] calldata target, uint256[] calldata amount) public onlyOwner {
        uint256 len = target.length;
        for (uint256 i = 0; i < len; i++) {
            _mint(target[i], amount[i]);
        }
    }

    /**
     * Mints the amount of tokens to the shareholder and instructs the wrapped contract to fetch and wrap them.
     * The necessary allowance is set automatically.
     */
    function mintAndWrap(address shareholder, address wrapper, uint256 amount) public {
        mint(shareholder, amount);
        _approve(shareholder, wrapper, amount);
        IWrapper(wrapper).mintFromBase(shareholder, amount);
    }

    /**
     * All-in-one function to mint and wrap tokens for multiple shareholders in one transaction.
     * 
     * See mintAndWrap for more information.
     */
    function mintAndWrapMany(address[] calldata target, address wrapper, uint256[] calldata amount) external {
        uint256 len = target.length;
        for (uint256 i = 0; i < len; i++) {
            mintAndWrap(target[i], wrapper, amount[i]);
        }
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
    /**
     * Notifies the successor token that tokens have been sent to it and burned on arrival.
     * Legally, this means that the right associated with the burned tokens now rest with the
     * successor contract. It is up to the successor contract and its terms to defined what
     * this means. Most likely, the successor contract will mint an according number of new
     * tokens for the indicated beneficiary, ensuring that the beneficiary retains control
     * over the tokens.
     */
    function notifyBurnedOnArrival(address beneficiary, uint256 amount) external;
}

/**
 * Interface that wrapper tokens should implement in order to support minting and wrapping
 * in one transaction.
 */
interface IWrapper {
    /**
     * When called, the wrapper contract is expected to fetch the indicated amount of base tokens
     * from the holder and mint the corresponding amount of wrapped tokens to the holder. The
     * wrapper contract can assume to have the necessary allowance.
     */
    function mintFromBase(address holder, uint256 baseTokens) external;
}
