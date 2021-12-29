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
pragma solidity ^0.8.0;

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

abstract contract ERC20Draggable is ERC20Flaggable, IERC677Receiver, IDraggable {
    
	uint8 private constant FLAG_VOTED = 1;

	IERC20 public wrapped; // The wrapped contract
	IOfferFactory public immutable factory;

	// If the wrapped tokens got replaced in an acquisition, unwrapping might yield many currency tokens
	uint256 public unwrapConversionFactor = 0;

	// The current acquisition attempt, if any. See initiateAcquisition to see the requirements to make a public offer.
	IOffer public offer;

	uint256 public immutable quorum; // BPS (out of 10'000)
	uint256 public immutable votePeriod; // In seconds

	address private oracle;

	event MigrationSucceeded(address newContractAddress, uint256 yesVotes, uint256 oracleVotes, uint256 totalVotingPower);

	constructor(
		address _wrappedToken,
		uint256 _quorum,
		uint256 _votePeriod,
		address _offerFactory,
		address _oracle
	) {
		wrapped = IERC20(_wrappedToken);
		quorum = _quorum;
		votePeriod = _votePeriod;
		factory = IOfferFactory(_offerFactory);
		oracle = _oracle;
	}

	function onTokenTransfer(
		address from,
		uint256 amount,
		bytes calldata
	) external override returns (bool) {
		require(msg.sender == address(wrapped));
		_mint(from, amount);
		return true;
	}

	/** Wraps additional tokens, thereby creating more ERC20Draggable tokens. */
	function wrap(address shareholder, uint256 amount) external {
		require(wrapped.transferFrom(msg.sender, address(this), amount));
		_mint(shareholder, amount);
	}

	/**
	 * Indicates that the token holders are bound to the token terms and that:
	 * - Conversion back to the wrapped token (unwrap) is not allowed
	 * - A drag-along can be performed by making an according offer
	 * - They can be migrated to a new version of this contract in accordance with the terms
	 */
	function isBinding() public view returns (bool) {
		return unwrapConversionFactor == 0;
	}

    /**
	 * Current recommended naming convention is to add the postfix "SHA" to the plain shares
	 * in order to indicate that this token represents shares bound to a shareholder agreement.
	 */
	function name() public view override returns (string memory) {
		if (isBinding()) {
			return string(abi.encodePacked(wrapped.name(), " SHA"));
		} else {
			return string(abi.encodePacked(wrapped.name(), " (Wrapped)"));
		}
	}

	function symbol() public view override returns (string memory) {
		// ticker should be less dynamic than name
		return string(abi.encodePacked(wrapped.symbol(), "S"));
	}

	/**
	 * Deactivates the drag-along mechanism and enables the unwrap function.
	 */
	function deactivate(uint256 factor) internal {
		require(factor >= 1, "factor");
		unwrapConversionFactor = factor;
		emit NameChanged(name(), symbol());
	}

	/** Decrease the number of drag-along tokens. The user gets back their shares in return */
	function unwrap(uint256 amount) external {
		require(!isBinding());
		unwrap(msg.sender, amount, unwrapConversionFactor);
	}

	function unwrap(
		address owner,
		uint256 amount,
		uint256 factor
	) internal {
		_burn(owner, amount);
		require(wrapped.transfer(owner, amount * factor));
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
		uint256 factor = isBinding() ? 1 : unwrapConversionFactor;
		IShares(address(wrapped)).burn(amount * factor);
	}

	function makeAcquisitionOffer(bytes32 salt, uint256 pricePerShare, address currency) external payable {
		require(isBinding());
		address newOffer = factory.create{value: msg.value}(salt, msg.sender, pricePerShare, currency, quorum, votePeriod);

		if (offerExists()) {
			offer.makeCompetingOffer(newOffer);
		}
		offer = IOffer(newOffer);
	}

	function drag(address buyer, address currency) external override {
		require(msg.sender == address(offer));
		unwrap(buyer, balanceOf(buyer), 1);
		replaceWrapped(currency, buyer);
	}

	function notifyOfferEnded() external override {
		if (msg.sender == address(offer)) {
			offer = IOffer(address(0));
		}
	}

	function replaceWrapped(address newWrapped, address oldWrappedDestination) internal {
		require(isBinding());
		// Free all old wrapped tokens we have
		require(wrapped.transfer(oldWrappedDestination, wrapped.balanceOf(address(this))));
		// Count the new wrapped tokens
		wrapped = IERC20(newWrapped);
		deactivate(wrapped.balanceOf(address(this)) / totalSupply());
	}

	function getOracle() public view override returns (address) {
		return oracle;
	}

	function setOracle(address newOracle) external {
		require(msg.sender == oracle, "not oracle");
		oracle = newOracle;
	}

	function migrateWithExternalApproval(address target, uint256 externalSupportingVotes) external {
		require(msg.sender == oracle);
		// Additional votes cannot be higher than the votes not represented by these tokens.
		// The assumption here is that more shareholders are bound to the shareholder agreement
		// that this contract helps enforce and a vote among all parties is necessary to change
		// it, with an oracle counting and reporting the votes of the others.
		require(totalSupply() + externalSupportingVotes <= totalVotingTokens());
		migrate(target, externalSupportingVotes);
	}

	function migrate() external {
		migrate(msg.sender, 0);
	}

	function migrate(address successor, uint256 additionalVotes) internal {
		uint256 yesVotes = additionalVotes + balanceOf(successor);
		uint256 totalVotes = totalVotingTokens();
		require(yesVotes < totalVotes);
		require(!offerExists()); // if you have the quorum, you can cancel the offer first if necessary
		require(yesVotes * 10000 >= totalVotes * quorum, "quorum");
		replaceWrapped(successor, successor);
		emit MigrationSucceeded(successor, yesVotes, additionalVotes, totalVotes);
	}

	function votingPower(address voter) external view override returns (uint256) {
		return balanceOf(voter);
	}

	function totalVotingTokens() public view override returns (uint256) {
		return IShares(address(wrapped)).totalShares();
	}

	function hasVoted(address voter) internal view returns (bool) {
		return hasFlagInternal(voter, FLAG_VOTED);
	}

	function notifyVoted(address voter) external override {
		setFlag(voter, FLAG_VOTED, true);
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 amount
	) internal virtual override {
		if (hasVoted(from) || hasVoted(to)) {
			if (offerExists()) {
				offer.notifyMoved(from, to, amount);
			} else {
				setFlag(from, FLAG_VOTED, false);
				setFlag(to, FLAG_VOTED, false);
			}
		}
		super._beforeTokenTransfer(from, to, amount);
	}

	function offerExists() internal view returns (bool) {
		return address(offer) != address(0);
	}
}

abstract contract IShares {
	function burn(uint256) external virtual;

	function totalShares() external view virtual returns (uint256);
}

abstract contract IOffer {
	function makeCompetingOffer(address newOffer) external virtual;

	function notifyMoved(
		address from,
		address to,
		uint256 value
	) external virtual;
}

abstract contract IOfferFactory {
	function create(
		bytes32 salt,
		address buyer,
		uint256 pricePerShare,
		address currency,
		uint256 quorum,
		uint256 votePeriod
	) external payable virtual returns (address);
}
