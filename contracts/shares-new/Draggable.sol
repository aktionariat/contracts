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

/**
 * @title CompanyName AG Shares
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * Executed a drag-along clause, fording minority shareholders to sell their shares to a buyer.
 * The drag-along has to be proposed by the contract owner and can then be executed with a 20 day delay.
 * It can be cancelled by the contract owner or any shareholder with 10% of the shares at any time before execution.
 * It can be executed by the contract owner or any shareholder with 90% of the shares without a delay.
 * Sellers get paid in the specified currency token directly from the buyer.
 */

import "../ERC20/ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract Draggable is ERC20Flaggable, Ownable, DeterrenceFee {

    struct Offer {
        IBuyerContract targetContract;
        uint24 timestamp;
	}

    uint24 public constant DRAG_PROPOSAL_DELAY = uint24(60 days);
    uint24 public constant DRAG_PROPOSAL_EXPIRATION = uint24(90 days);

    Offer public latestOffer;
    
    error InvalidOffer();
    error NoOfferFound();
    error OfferPending();
    error DragAlongNotFound();
    error CannotCancel();
    error DragAlongTooEarly(uint256 timestamp);

    event OfferMade(address sender, IBuyerContract buyerContract, string message);
    event OfferDenied(address sender, string message);
    event OfferAccepted(address sender, IBuyerContract offer, uint256 tokens, address currency, uint256 pricePerTokenE18);

    /**
     * Make an acquisition offer for all underlying tokens.
     * 
     * If the acquisition offer is not denied by the issuer or someone with 10% of the outstanding tokens,
     * the offer can be executed. The buyer contract must implement the IBuyerContract.notifyTokensReceived
     * function as specified.
     */
    function offerAcquisition(IBuyerContract buyerContract, string calldata message) external deter(100) return (Offer memory) {
        if (acquisitionOffer.targetContract != address(0)) revert OfferPending(); 
        dragAlongProposal = Offer({ buyer: address(buyerContract), timestamp: uint24(block.timestamp) });
        emit OfferMade(msg.sender, buyerContract, message);
        return dragAlongProposal;
	}

    modifier offerPresent() {
        if (address(offer.buyerContract) == address(0x0)) revert NoOfferFound();
        _;
    }

    /**
     * Cancels the current offer.
     * 
     * This can be called by the issuer, the owner of the offer, or anyone with 10% of the tokens.
     * 
     * Being able to cancel an offer does not mean that you are also legally allowed to.
     */
    function cancelOffer(string calldata message) external offerPresent {
        if (!canCancelOffer(msg.sender)) revert CannotCancel();
        delete offer;
        emit OfferDenied(msg.sender, message);
    }

    /**
     * Returns whether the given address can cancel the current offer.
     */
    function canCancelOffer(address holder) public view offerPresent returns (bool) {
        if (holder == owner){
            return true; // issuer can cancel
        } else if (offer.timestamp + DRAG_PROPOSAL_EXPIRATION < block.timestamp){
            return true; // offer expired, anyone can cancel
        } else if (balanceOf(holder) > totalSupply() / 10) {
            return true; // anyone with 10% of the tokens can cancel
        } else {
            try Ownable(offer).owner() returns (address offerOwner) {
                // owner of offer can cancel
                return offerOwner == holder;
            } catch {
                // offer does not implement Ownable
                return false;
            }
        }
    }
    
    function acceptOffer() public offerPresent {
        if (dragAlongProposal.timestamp + DRAG_PROPOSAL_DELAY < block.timestamp) revert DragAlongTooEarly();
        IERC20 wrappedToken = wrapped();
        uint256 balance = wrapped().balanceOf(address(this));
        wrappedToken.transfer(offer.buyerContract, balance);
        uint256 ownedTokensToBurn = offer.buyerContract.notifyTokensReceived(balance);
        _burn(address(offer.buyerContract), ownedTokensToBurn);
        IERC20 currency = offer.buyerContract.offeredCurrency();
        uint256 price = offer.buyerContract.offeredPrice();
        replaceBase(currency, price);
        emit OfferAccepted(msg.sender, offer.buyerContract, balance, currency, price);
    }

    function base() public abstract returns (IERC20);

    function replaceBase(IERC20 wrapped, uint256 factorE18) internal abstract;

}

interface IBuyerContract {

    function offeredCurrency() external view returns (IERC20);

    /**
     * Conversion price with 18 decimals.
     */
    function offeredPrice() external view returns (uint92);

    /**
     * When this is called on the buyer contract, the payment should be made back to the calling contract.
     * 
     * The buyer contract can also indicate how many of their own tokens should be burned in order to reduce the
     * acquisition costs. For example, if the buyer contract already has 2000 out of 10'000 wrapper tokens and
     * the price is 3 per share, they can indicate that 2000 wrapper token should be burned so they only need
     * to pay 24'000 to finance the acquisition of the 10'000 wrapped tokens.
     */
    function notifyTokensReceived(uint256 amount) returns (uint256 ownedTokensToBurn);

}