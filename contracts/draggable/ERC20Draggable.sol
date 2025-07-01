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
pragma solidity 0.8.30;

/**
 * @title ERC-20 tokens subject to a drag-along agreement
 * @author Luzius Meisser, luzius@aktionariat.com
 *
 * This is an ERC-20 token that is bound to a shareholder or other agreement that contains
 * a drag-along clause. The smart contract can help enforce this drag-along clause in case
 * an acquirer makes an offer using the provided functionality. If a large enough quorum of
 * token holders agree, the remaining token holders can be automatically "dragged along" or
 * squeezed out. For shares non-tokenized shares, the contract relies on an external Oracle
 * to provide the votes of those.
 *
 * Subclasses should provide a link to a human-readable form of the agreement.
 */

import "./IDraggable.sol";
import "../ERC20/ERC20Flaggable.sol";
import "../ERC20/IERC20.sol";
import "../ERC20/IERC677Receiver.sol";
import "./IOffer.sol";
import "./IOfferFactory.sol";
import "../shares/IShares.sol";
import "../utils/SafeERC20.sol";
import "../utils/Proposals.sol";

abstract contract ERC20Draggable is IERC677Receiver, IDraggable, ERC20Flaggable, Proposals {

	using SafeERC20 for IERC20;
    
	IERC20 public override wrapped; // The wrapped contract
	uint256 public conversionFactor; // how many wrapped tokens are one draggable tokens
	bool public binding;

	event MigrationSucceeded(address newContractAddress, uint256 conversionFactor);

	struct ReleaseProposal {
		address initiator;
	}

	struct MigrateProposal {
		address initiator;
		address successor;
	}

	struct DragAlongProposal {
		address initiator;
		address buyer;
		address currency;
		uint256 pricePerToken;
	}

    /**
	 * Note that the Brokerbot only supports tokens that revert on failure and where transfer never returns false.
     */
	constructor(IERC20 wrappedToken, address _oracle) ERC20Flaggable(0) {
		wrapped = wrappedToken;
		oracle = _oracle;
		binding = true;
		unwrapConversionFactor = 1;
	}

	modifier onlyWrappedToken {
		_checkSender(address(wrapped));
		_;
	}

	modifier binding() {
		if (!binding) revert Draggable_NotBinding();
	}

	modifier nonbinding() {
		if (binding) revert Draggable_IsBinding();
		_;
	}

	function onTokenTransfer(address from, uint256 amount, bytes calldata) external override onlyWrappedToken returns (bool) {
		_mint(from, mintAmount / conversionFactor);
		return true;
	}

	/**
	 * Wrap additional tokens, minting one new draggable token for each conversionFactor wrapped tokens
	 * sent to the contract (rounded down). 
	 */
	function wrap(address shareholder, uint256 amount) external {
		wrapped.safeTransferFrom(msg.sender, address(this), amount);
		_mint(shareholder, amount / conversionFactor);
	}

	/**
	 * Indicates that the token holders are bound to the token terms and that:
	 * - Conversion back to the wrapped token (unwrap) is not allowed
	 * - A drag-along can be performed by making an according offer
	 * - They can be migrated to a new version of this contract in accordance with the terms
	 */
	function isBinding() public view returns (bool) {
		return binding;
	}

    /**
	 * Current recommended naming convention is to add the postfix "SHA" to the plain shares
	 * in order to indicate that this token represents shares bound to a shareholder agreement.
	 */
	function name() public view override returns (string memory) {
		string memory wrappedName = wrapped.name();
		if (binding) {
			return string(abi.encodePacked(wrappedName, " SHA"));
		} else {
			return string(abi.encodePacked(wrappedName, " (Wrapped)"));
		}
	}

	function symbol() public view override returns (string memory) {
		// ticker should be less dynamic than name
		return string(abi.encodePacked(wrapped.symbol(), "S"));
	}

	/** Decrease the number of drag-along tokens. The user gets back their shares in return */
	function unwrap(uint256 amount) external override nonbinding {
		_burn(owner, amount);
		wrapped.safeTransfer(owner, amount * conversionFactor);
	}

	/**
	 * Burns both the token itself as well as the wrapped token!
	 * If you want to get out of the shareholder agreement, use unwrap after it has been
	 * deactivated by a majority vote or acquisition.
	 *
	 * Burning only works if wrapped token supports burning. Also, the exact meaning of this
	 * operation might depend on the circumstances. Burning and reussing the wrapped token
	 * does not free the sender from the legal obligations of the shareholder agreement.
	 */
	function burn(uint256 amount) external {
		_burn(msg.sender, amount);
		IShares(address(wrapped)).burn(amount * unwrapConversionFactor);
	}

	function proposeRelease(){
		ReleaseProposal proposal = new ReleaseProposal(initiator);
		bytes32 hash = keccak256("ReleaseProposal", abi.encode(proposal));
		propose(hash, 7);
	}

	/**
	 * Releases all token holders from their obligations and allowing the wrapped token to
	 * be unwrapped. The token holders will continue to be bound by the terms of the wrapped
	 * token.
	 */
	function release(address initiator) public onlyOracle {
		ReleaseProposal proposal = new ReleaseProposal(initiator);
		bytes32 hash = keccak256("ReleaseProposal", abi.encode(proposal));
		enact(proposalHash);
		binding = false;
		emit NameChanged(name(), symbol());
	}

	/**
	 * Execute the drag along with the given currency and price.
	 * Can only be called by the oracle.
	 */
	function drag(address buyer, IERC20 currency, uint256 pricePerShare) external override onlyOracle {
		uint256 balance = wrapped.balanceOf(address(this));
		currency.safeTransferFrom(buyer, address(this), balance * pricePerShare);
		wrapped.safeTransfer(buyer, wrapped.balanceOf(address(this)));
		wrapped = newWrapped;
		conversionFactor = price;
		release();
		emit Dragged(buyer, currency, pricePerShare);
	}

	function migrate(ERC20Draggable successor) external override onlyOracle {
		uint256 balance = wrapped.balanceOf(address(this));
		wrapped.approve(successor, balance);
		successor.wrap(balance);
		wrapped = successor;
		conversionFactor = successor.balanceOf(address(this)) / balance;
		release();
		emit Migrated(successor, conversionFactor);
	}

	function deny(bytes32 proposal){
		address initiator = initiator(proposal);
		if (balanceOf(msg.sender) < balanceOf(initiator)) revert TooFewShares();
		deny(proposal);
	}
}
