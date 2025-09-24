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
import "./Burnable.sol";
import "./Draggable.sol";
import "./Migratable.sol";
import "../ERC20/ERC20Allowlistable.sol";
import "../ERC20/IERC677Receiver.sol";
import "../ERC20/ERC20PermitLight.sol";
import "../ERC20/ERC20Permit2.sol";
import "../utils/SafeERC20.sol";

/**
 * @title CompanyName AG Shares SHA
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * This is an ERC-20 token representing share tokens of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 */
contract WrappedShares is IERC20, ERC20Allowlistable, Recoverable, Burnable, Draggable, Migratable, IERC677Receiver, ERC20PermitLight, ERC20Permit2 {
    using SafeERC20 for IERC20;

    // Version history:
    // 1: pre permit
    // 2: includes permit
    // 3: added permit2 allowance, VERSION field
    // 4: New token standard
    uint8 public constant VERSION = 4;

    // Base shares being wrapped and SHA terms
	IERC20 public baseShares;
    string public terms;
    bool public isBinding = true;

    /// Event when the terms are changed with setTerms().
    event ChangeTerms(string terms); 
    
    error Unwrap_IsBinding();

    constructor(
        string memory _terms,
        uint8 _decimals,
        address _owner,
        Permit2Hub _permit2Hub
    ) 
        ERC20Flaggable(_decimals)
        Ownable(_owner)
        ERC20Allowlistable() 
        ERC20Permit2(_permit2Hub) 
    {
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
	 */
	function wrap(address shareholder, uint256 amount) external {
		baseShares.safeTransferFrom(msg.sender, address(this), amount);
		_mint(shareholder, amount);
	}
    
    function forceUnwrap(address owner, uint256 amount) external onlyOwner {
        _unwrap(owner, amount);
	}
    	
    function unwrap(uint256 amount) external {
        if (isBinding) revert Unwrap_IsBinding();
        _unwrap(msg.sender, amount);
	}

    function _unwrap(address owner, uint256 amount) internal {
		_burn(owner, amount);
		baseShares.safeTransfer(owner, amount);
    }

	/**
	 * Burns both the token itself as well as the wrapped token!
	 * If you want to get out of the shareholder agreement, use unwrap after it has been
	 * deactivated by a majority vote or acquisition.
	 *
	 * Burning only works if wrapped token supports burning. Also, the exact meaning of this
	 * operation might depend on the circumstances. Burning and reissuing the wrapped token
	 * does not free the sender from the legal obligations of the shareholder agreement.
	 */
	function burn(uint256 amount) external {
		_burn(msg.sender, amount);
		BaseShares(address(baseShares)).burn(amount);
	}

    /**
	 * Transfers tokens, respecting ERC20Flaggable flag logic
	 */
    function transfer(address to, uint256 value) virtual override(IERC20, ERC20Flaggable) public returns (bool) {
        return ERC20Flaggable.transfer(to, value);
    }

    /**
	 * Hook to be called before any transfer.
     * ERC20Flaggable by default has an empty implementation.
     * ERC20allowlistable implements allowlist logic.
	 */
    function _beforeTokenTransfer(address from, address to, uint256 amount) override(ERC20Flaggable, ERC20Allowlistable) internal {
        ERC20Allowlistable._beforeTokenTransfer(from, to, amount);
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

    /**
	 * Overriding the allowance function.
     * ERC20Permit2 is specifically used, since it checks for Permit2 and then falls back to ERC20Flaggable.
	 */
    function allowance(address owner, address spender) public view override(ERC20Permit2, ERC20Flaggable, IERC20) returns (uint256) {
        return ERC20Permit2.allowance(owner, spender);
    }

    // Proposals

    function _executeBurn(address burnAddress, uint256 amount) internal override {
		_burn(burnAddress, amount);
		IShares(address(baseShares)).burn(amount);
    }

    function _executeDragAlong(address buyer, address currencyToken, uint256 pricePerShare) internal override {
        // TO DO
    }

    function _executeMigration(address successor) internal override {
        // TO DO
    }

    
    // Modifiers //

    /**
	 * Allow only the base shares contract to call a function.
	 */
	modifier onlyBaseShares {
		_checkSender(address(baseShares));
		_;
	}
}