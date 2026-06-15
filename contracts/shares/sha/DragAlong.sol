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
 * Executes a drag-along clause, forcing minority shareholders to sell their shares to a buyer.
 * The drag-along can be proposed by anyone and can be executed after a 20 day delay.
 * It can be cancelled by the contract owner or any shareholder with 10% of the shares at any time before execution.
 * Sellers get paid in the specified currency token directly from the buyer.
 */
import "../../utils/Ownable.sol";
import "../../utils/SafeERC20.sol";
import "../../utils/DeterrenceFee.sol";
import "../../ERC20/ERC20Flaggable.sol";

abstract contract DragAlong is ERC20Flaggable, Ownable, DeterrenceFee {

    using SafeERC20 for IERC20;

    struct Offer {
        address buyer; // 160 Bits
        uint64 timestamp; // 64 Bits
        IERC20 currency; // 160 Bits
        uint256 pricePerShareE18; // 256 Bits — currency units paid per wrapped unit at execution
	}

    uint64 public constant DRAG_PROPOSAL_DELAY = uint64(20 days);

    Offer public latestOffer;
    
    error NoOfferFound();
    error OfferPending();
    error CannotCancel();
    error DragAlongTooEarly(uint256 earliest, uint256 timeNow);

    event OfferMade(address sender, IERC20 currency, uint256 pricePerShareE18, string message);
    event OfferDenied(address sender, string message);
    event OfferAccepted(address sender, address buyer, uint256 tokens, address currency, uint256 pricePerShareE18, uint256 totalPrice);

    /**
     * Make an acquisition offer for the underlying tokens.
     *
     * The buyer commits to paying 'pricePerShareE18' currency units per wrapped unit. The total price
     * is computed at execution time as 'pricePerShareE18 * totalSupply() / 10**18'. If new shares are tokenized
     * during the proposal delay, the buyer pays proportionally more so existing holders are not
     * diluted in their per-share proceeds. The buyer must approve enough currency to cover the
     * worst-case total they are willing to pay.
     *
     * If the acquisition offer is not denied by the issuer or someone with 10% of the outstanding tokens,
     * the offer can be executed.
     *
     * The ability to execute an acquisition does not necessarily mean that you are also legally allowed to.
     * It is the responsibility of the caller to ensure that all contractual preconditions for the execution of the acquisition have been met,
     * as typically laid out in a shareholder agreement.
     */
    function offerAcquisition(IERC20 currency, uint256 pricePerShareE18, string calldata message) external payable deter(100) returns (Offer memory) {
        if (address(latestOffer.buyer) != address(0)) revert OfferPending();
        latestOffer = Offer({ buyer: msg.sender, timestamp: uint64(block.timestamp), currency: currency, pricePerShareE18: pricePerShareE18 });
        emit OfferMade(msg.sender, currency, pricePerShareE18, message);
        return latestOffer;
	}

    modifier offerPresent() {
        if (address(latestOffer.buyer) == address(0x0)) revert NoOfferFound();
        _;
    }

    /**
     * Cancels the current offer.
     * 
     * Being able to cancel an offer does not mean that you are also legally allowed to.
     */
    function cancelOffer(string calldata message) external offerPresent {
        if (!canCancelOffer(msg.sender)) revert CannotCancel();
        delete latestOffer;
        emit OfferDenied(msg.sender, message);
    }

    /**
     * Returns whether the given address can cancel the current offer.
     */
    function canCancelOffer(address holder) public view offerPresent returns (bool) {
        return holder == owner || balanceOf(holder) > totalSupply() / 10 || latestOffer.buyer == holder;
    }


    function checkExecution() public view offerPresent {
        if (block.timestamp < latestOffer.timestamp + DRAG_PROPOSAL_DELAY) revert DragAlongTooEarly(latestOffer.timestamp + DRAG_PROPOSAL_DELAY, block.timestamp);
    }
    
    /**
     * Accepts the current offer once the proposal delay has passed.
     */
    function acceptOffer() public offerPresent {
        checkExecution(); // reverts if sender is not allowed to execute yet

        IERC20 wrappedToken = baseToken();
        Offer memory offer = latestOffer;
        delete latestOffer; // clear the offer to prevent reentrancy

        uint256 balance = wrappedToken.balanceOf(address(this));
        uint256 totalPrice = offer.pricePerShareE18 * totalSupply() / 10**18; // priced at execution time so new tokenizations during the delay do not dilute per-share proceeds
        offer.currency.safeTransferFrom(address(offer.buyer), address(this), totalPrice);
        wrappedToken.safeTransfer(address(offer.buyer), balance);

        replaceBase(offer.currency);  // make the purchase proceeds the new base
        terminate(); // allow token holders to unwrap and collect proceeds

        emit OfferAccepted(msg.sender, offer.buyer, balance, address(offer.currency), offer.pricePerShareE18, totalPrice);
    }

    function baseToken() internal virtual view returns (IERC20);

    function replaceBase(IERC20 wrapped) internal virtual;

    function terminate() internal virtual;

}