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

import "../ERC20/ERC20Named.sol";
import "../ERC20/ERC20Flaggable.sol";
import "../utils/Ownable.sol";
import "./DeterrenceFee.sol";

abstract contract Draggable is ERC20Flaggable, Ownable, DeterrenceFee {

    struct Offer {
        IBuyerContract buyer; // 160 Bits
        uint64 timestamp; // 64 Bits
        // 32 Bit left
	}

    uint64 public constant DRAG_PROPOSAL_DELAY = uint64(60 days);
    uint64 public constant DRAG_PROPOSAL_EXPIRATION = uint64(90 days);

    Offer public latestOffer;
    
    error InvalidOffer();
    error NoOfferFound();
    error OfferPending();
    error DragAlongNotFound();
    error CannotCancel();
    error DragAlongTooEarly(uint256 earliest, uint256 timeNow);

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
    function offerAcquisition(IBuyerContract buyerContract, string calldata message) external payable deter(100) returns (Offer memory) {
        if (address(latestOffer.buyer) != address(0)) revert OfferPending(); 
        latestOffer = Offer({ buyer: buyerContract, timestamp: uint64(block.timestamp) });
        emit OfferMade(msg.sender, buyerContract, message);
        return latestOffer;
	}

    modifier offerPresent() {
        if (address(latestOffer.buyer) == address(0x0)) revert NoOfferFound();
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
        delete latestOffer;
        emit OfferDenied(msg.sender, message);
    }

    /**
     * Returns whether the given address can cancel the current offer.
     */
    function canCancelOffer(address holder) public view offerPresent returns (bool) {
        if (holder == owner){
            return true; // issuer can cancel
        } else if (latestOffer.timestamp + DRAG_PROPOSAL_EXPIRATION < block.timestamp){
            return true; // offer expired, anyone can cancel
        } else if (balanceOf(holder) > totalSupply() / 10) {
            return true; // anyone with 10% of the tokens can cancel
        } else {
            try Ownable(address(latestOffer.buyer)).owner() returns (address offerOwner) {
                // owner of offer can cancel
                return offerOwner == holder;
            } catch {
                // offer does not implement Ownable
                return false;
            }
        }
    }
    
    function acceptOffer() public offerPresent {
        if (latestOffer.timestamp + DRAG_PROPOSAL_DELAY < block.timestamp) revert DragAlongTooEarly(latestOffer.timestamp + DRAG_PROPOSAL_DELAY, block.timestamp);
        IERC20 wrappedToken = baseToken();
        IBuyerContract buyer = latestOffer.buyer;

        // send full base balance to the buyer
        uint256 balance = wrappedToken.balanceOf(address(this));
        wrappedToken.transfer(address(buyer), balance);

        // Notify the buyer that the tokens have been transferred
        // Also the last chance for the buyer to set the approval
        uint256 buyerTokensToBurn = buyer.notifyTokensReceived(balance);

        // burn the indicated amount of buyer owned tokens to make the purchase cheaper
        _burn(address(buyer), buyerTokensToBurn);

        // get the money from the buyer, requires buyer approval
        IERC20 currency = buyer.offeredCurrency();
        uint256 priceE18 = buyer.offeredPrice();
        currency.transferFrom(address(buyer), address(this), totalSupply() * priceE18 / 10**18);

        replaceBase(currency);  // make the purchase proceeds the new base
        terminate(); // allow token holders to unwrap and collect proceeds

        emit OfferAccepted(msg.sender, latestOffer.buyer, balance, address(currency), priceE18);
    }

    function baseToken() internal virtual returns (IERC20);

    function replaceBase(IERC20 wrapped) internal virtual;

    function terminate() internal virtual;

}

interface IBuyerContract {

    function offeredCurrency() external view returns (IERC20);

    /**
     * Conversion price with 18 decimals.
     */
    function offeredPrice() external view returns (uint256);

    /**
     * When this is called on the buyer contract, the payment should be made back to the calling contract.
     * 
     * The buyer contract can also indicate how many of their own tokens should be burned in order to reduce the
     * acquisition costs. For example, if the buyer contract already has 2000 out of 10'000 wrapper tokens and
     * the price is 3 per share, they can indicate that 2000 wrapper token should be burned so they only need
     * to pay 24'000 to finance the acquisition of the 10'000 wrapped tokens.
     */
    function notifyTokensReceived(uint256 amount) external returns (uint256 ownTokensToBurn);

}