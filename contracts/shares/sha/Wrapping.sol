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

/**
 * @title CompanyName AG Shares
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * An ERC-20 token that wraps a base token 1:1 under terms defined by the inheriting contract.
 *
 * While the terms are binding, base tokens can be wrapped but not unwrapped. Once the terms cease to
 * be binding, after a termination, a migration or an executed acquisition, every holder can unwrap and
 * receive their proportional share of whatever the wrapper holds: the original base token, the
 * successor token, or the acquisition proceeds. Whether the terms are binding, and what it means to
 * terminate them, is answered by the inheriting contract through 'isBinding' and 'terminate'.
 *
 * Holders who never act would leave the wrapper in a half-migrated state forever. The issuer can
 * therefore propose to complete the unwrap for a holder. Such a proposal delivers the holder's full
 * balance to the holder's own address and nowhere else. It can be cancelled by the holder, whose
 * ability to do so shows that the address is active, or by the issuer, and executed by anyone after
 * the delay. Nobody is moved to a different address or a different token without the chance to object.
 */
import "../../utils/Ownable.sol";
import "../../utils/SafeERC20.sol";
import "../../ERC20/ERC20Flaggable.sol";

abstract contract Wrapping is ERC20Flaggable, Ownable {
    using SafeERC20 for IERC20;

    // Base security token
    IERC20 public base;

    uint64 public constant UNWRAP_PROPOSAL_DELAY = uint64(20 days);

    mapping(address holder => uint40 proposedAt) public unwrapProposals;

    event Wrapped(address base, address sender, address recipient, uint256 amount);
    event Unwrapped(address holder, uint256 amount, uint256 baseAmount);
    event BaseTokenReplaced(IERC20 old, IERC20 neu);
    event UnwrapProposed(address holder);
    event UnwrapProposalCancelled(address sender, address holder);

    error ContractBinding();
    error ContractNotBinding();
    error NothingToUnwrap(address holder);
    error UnwrapPending(address holder);
    error UnwrapNotFound(address holder);
    error UnwrapTooEarly(uint256 earliest, uint256 timenow);

    constructor(IERC20 base_) {
        base = base_;
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
     *
     * A pending unwrap proposal for the sender is cancelled: the holder acting is what the proposal was waiting for.
     */
    function unwrap(uint256 amount) external requireNonBinding {
        if (unwrapProposals[msg.sender] != 0) {
            _cancelUnwrap(msg.sender);
        }
        _unwrap(msg.sender, amount);
    }

    function convertToBase(uint256 amount) public view returns (uint256) {
        return amount * base.balanceOf(address(this)) / totalSupply();
    }

    /**
     * Proposes to complete the unwrap for a holder who has not done so themselves.
     *
     * Only possible once the terms are no longer binding. When executed, the holder receives their
     * full balance at their own address.
     */
    function proposeUnwrap(address holder) public onlyOwner requireNonBinding {
        if (balanceOf(holder) == 0) revert NothingToUnwrap(holder);
        if (unwrapProposals[holder] != 0) revert UnwrapPending(holder);
        unwrapProposals[holder] = uint40(block.timestamp);
        emit UnwrapProposed(holder);
    }

    function proposeUnwrap(address[] calldata holders) external onlyOwner {
        uint256 len = holders.length;
        for (uint256 i = 0; i < len; i++) {
            proposeUnwrap(holders[i]);
        }
    }

    /**
     * The holder objects to the proposed unwrap of their own address.
     */
    function cancelUnwrap() external {
        _cancelUnwrap(msg.sender);
    }

    /**
     * Cancel a proposed unwrap for a contract you own.
     */
    function cancelUnwrapOnOwnedContract(Ownable ownedContract) external {
        if (ownedContract.owner() != msg.sender) revert Ownable_NotOwner(msg.sender);
        _cancelUnwrap(address(ownedContract));
    }

    function cancelUnwrap(address holder) external onlyOwner {
        _cancelUnwrap(holder);
    }

    function _cancelUnwrap(address holder) internal {
        if (unwrapProposals[holder] == 0) revert UnwrapNotFound(holder);
        delete unwrapProposals[holder];
        emit UnwrapProposalCancelled(msg.sender, holder);
    }

    /**
     * Anyone can execute a proposed unwrap once the delay has passed.
     *
     * The move is subject to the transfer rules of this token and of the base token. A restricted
     * (frozen) holder cannot be unwrapped; the issuer unfreezes the address first. A holder who
     * transferred their tokens away in the meantime has nothing left to unwrap; the proposal
     * stays until the issuer cancels it.
     */
    function executeUnwrap(address holder) external {
        uint40 proposedAt = unwrapProposals[holder];
        if (proposedAt == 0) revert UnwrapNotFound(holder);
        uint256 earliest = proposedAt + UNWRAP_PROPOSAL_DELAY;
        if (block.timestamp < earliest) revert UnwrapTooEarly(earliest, block.timestamp);
        uint256 amount = balanceOf(holder);
        if (amount == 0) revert NothingToUnwrap(holder);
        delete unwrapProposals[holder];
        _unwrap(holder, amount);
    }

    function _unwrap(address holder, uint256 amount) internal {
        uint256 baseAmount = convertToBase(amount); // rounds down
        _burn(holder, amount);
        base.safeTransfer(holder, baseAmount);
        emit Unwrapped(holder, amount, baseAmount);
    }

    /**
     * Replaces the base token.
     * 
     * Often done in combination with a termination.
     */
    function replaceBase(IERC20 wrapped_) internal {
        emit BaseTokenReplaced(base, wrapped_);
        base = wrapped_;
    }

    /**
     * Whether the terms are binding. Wrapping is only possible while they are, unwrapping only once they are not.
     */
    function isBinding() internal view virtual returns (bool);

    /**
     * Causes the terms to not be binding any more. Called on an executed acquisition or migration.
     */
    function terminate() internal virtual;

    /**
     * Public defense against someone trying to recover tokens this contract holds.
     */
    function cancelBaseRecovery() external {
        IBaseToken(address(base)).cancelRecovery();
    }

    /**
     * Allow only the base shares contract to call a function.
     */
    modifier baseOnly() {
        _checkSender(address(base));
        _;
    }

    modifier requireBinding() {
        if (!isBinding()) revert ContractNotBinding();
        _;
    }

    modifier requireNonBinding() {
        if (isBinding()) revert ContractBinding();
        _;
    }
}

interface IBaseToken {
    function cancelRecovery() external;
}
