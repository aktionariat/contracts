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
pragma solidity >=0.7;

import "./IERC20.sol";
import "./SafeMath.sol";
import "./ERC20.sol";
import "./Acquisition.sol";
import "./IMigratable.sol";
import "./IERC677Receiver.sol";

/**
 * @title CompanyName Shareholder Agreement
 * @author Benjamin Rickenbacher, b.rickenbacher@intergga.ch
 * @author Luzius Meisser, luzius@meissereconomics.com
 * @dev These tokens are based on the ERC20 standard and the open-zeppelin library.
 *
 * This is an ERC-20 token representing shares of CompanyName AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'
 * of the 'DraggableCompanyNameShares' contract. The agreement is partially enforced
 * through the Swiss legal system, and partially enforced through this smart contract.
 * In particular, this smart contract implements a drag-along clause which allows the
 * majority of token holders to force the minority sell their shares along with them in
 * case of an acquisition. That's why the tokens are called "Draggable CompanyName AG Shares."
 */

contract ERC20Draggable is ERC20, IERC677Receiver {

    using SafeMath for uint256;

    IERC20 public wrapped;                        // The wrapped contract

    // If the wrapped tokens got replaced in an acquisition, unwrapping might yield many currency tokens
    uint256 public unwrapConversionFactor = 1;

    // The current acquisition attempt, if any. See initiateAcquisition to see the requirements to make a public offer.
    Acquisition public offer;

    uint256 public migrationQuorum;        // Number of tokens that need to be migrated to complete migration
    uint256 public acquisitionQuorum;

    uint256 constant MIN_OFFER_INCREMENT = 10500;  // New offer must be at least 105% of old offer
    uint256 constant MIN_DRAG_ALONG_QUOTA = 3000;  // 30% of the equity needs to be represented by drag along tokens for an offer to be made

    bool public active = true;                     // True as long as this contract is legally binding and the wrapped tokens are locked.

    event OfferCreated(address indexed buyer, uint256 pricePerShare, address currency, address offerContract);
    event OfferEnded(address indexed buyer, address sender, bool success, string message, address offerContract);
    event MigrationSucceeded(address newContractAddress);

    /**
     * CurrencyAddress specifies the currency used in acquisitions. The currency must be
     * an ERC-20 token that returns true on successful transfers and throws an exception or
     * returns false on failure. It can only be updated later if the currency supports the
     * IMigratable interface.
     */
    constructor(
        address wrappedToken,
        uint256 migrationQuorumInBIPS_,
        uint256 acquisitionQuorum_
    ) ERC20(0) {
        wrapped = IERC20(wrappedToken);
        migrationQuorum = migrationQuorumInBIPS_;
        acquisitionQuorum = acquisitionQuorum_;
        IShares(wrappedToken).totalShares(); // check if wrapped token supports this method
    }

    function name() public override view returns (string memory){
        return string(abi.encodePacked("Draggable ", wrapped.name()));
    }

    function symbol() public override view returns (string memory){
        return string(abi.encodePacked("D", wrapped.symbol()));
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata) override public {
        require(msg.sender == address(wrapped));
        dowrap(from, amount);
    }

    /** Increases the number of drag-along tokens. Requires minter to deposit an equal amount of share tokens */
    function wrap(address shareholder, uint256 amount) public noOfferPending() {
        require(wrapped.transferFrom(msg.sender, address(this), amount));
        dowrap(shareholder, amount);
    }

    function dowrap(address shareholder, uint256 amount) internal noOfferPending() {
        require(active, "not active");
        _mint(shareholder, amount);
    }

    /** Decrease the number of drag-along tokens. The user gets back their shares in return */
    function unwrap(uint256 amount) public returns (address, uint256) {
        require(!active, "active");
        _burn(msg.sender, amount);
        uint256 unwrappedTokens = amount.mul(unwrapConversionFactor);
        require(wrapped.transfer(msg.sender, unwrappedTokens));
        return (address(wrapped), unwrappedTokens); // Pre August 2020 version did not have a return value
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
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
        IBurnable(address(wrapped)).burn(amount.mul(unwrapConversionFactor));
    }

  /** @dev Function to start drag-along procedure
   *  This can be called by anyone, but there is an upfront payment.
   */
    function initiateAcquisition(uint256 pricePerShare, address currency) public {
        require(active);
        uint256 totalEquity = IShares(address(wrapped)).totalShares();
        require(totalSupply() >= totalEquity.mul(MIN_DRAG_ALONG_QUOTA).div(10000), "This contract does not represent enough equity");

        // License Fee to Aktionariat AG, also ensures that offer is serious
        0x29Fe8914e76da5cE2d90De98a64d0055f199d06D.transfer(3 ether);

        Acquisition newOffer = new Acquisition(msg.sender, currency, pricePerShare, acquisitionQuorum);
        require(newOffer.isWellFunded(totalSupply() - balanceOf(msg.sender)), "Insufficient funding");
        if (offerExists()) {
            require(currency == offer.currency() && pricePerShare >= offer.price().mul(MIN_OFFER_INCREMENT).div(10000), "New offers must be at least 5% higher than the pending offer");
            killAcquisition("Offer replaced by higher bid");
        }
        offer = newOffer;

        emit OfferCreated(msg.sender, pricePerShare, currency, address(offer));
    }

    function voteYes() public offerPending() {
        offer.voteYes(msg.sender, balanceOf(msg.sender));
    }

    function voteNo() public offerPending() {
        offer.voteNo(msg.sender, balanceOf(msg.sender));
    }

    function cancelAcquisition() public offerPending() {
        require(msg.sender == offer.buyer());
        killAcquisition("Cancelled");
    }

    function contestAcquisition() public offerPending() {
        if (offer.hasExpired()) {
            killAcquisition("Expired");
        } else if (offer.quorumHasFailed()) {
            killAcquisition("Not enough support");
        } else if (!offer.isWellFunded(totalSupply() - balanceOf(offer.buyer()))) {
            killAcquisition("Insufficient funds");
        }
    }

    function killAcquisition(string memory message) internal {
        address buyer = offer.buyer();
        emit OfferEnded(
            buyer,
            msg.sender,
            false,
            message,
            address(offer)
        );
        offer.kill();
        offer = Acquisition(address(0));
    }

    function completeAcquisition() public offerPending() {
        require(msg.sender == offer.buyer());
        require(offer.isQuorumReached(), "Insufficient support");
        //not necessary to check funding, will fail anyway if not enough
        //require(offer.isWellFunded(totalSupply() - balanceOf(buyer)), "insufficient funds");
        invertHoldings(msg.sender, offer.currency(), offer.price());
        emit OfferEnded(
            msg.sender,
            msg.sender,
            true,
            "Success",
            address(offer)
        );
    }

    function invertHoldings(address newOwner, address newWrapped, uint256 conversionRate) internal {
        uint256 buyerBalance = balanceOf(newOwner);
        uint256 initialSupply = totalSupply();
        active = false;
        unwrap(buyerBalance);
        uint256 remaining = initialSupply.sub(buyerBalance);
        require(wrapped.transfer(newOwner, remaining));
        wrapped = IERC20(newWrapped);
        unwrapConversionFactor = conversionRate;
        require(wrapped.transferFrom(newOwner, address(this), conversionRate.mul(remaining)));
    }

    function migrate() public {
        require(active, "not active");
        address successor = msg.sender;
        require(balanceOf(successor) >= totalSupply().mul(migrationQuorum).div(10000), "Quorum not reached");

        if (offerExists()) {
            voteNo(); // should shut down the offer
            contestAcquisition();
            assert(!offerExists());
        }

        invertHoldings(successor, successor, 1);
        emit MigrationSucceeded(successor);
    }

    // not needed in the default implementation as wrap requires no offer
    /* function _mint(address account, uint256 amount) virtual override internal {
        super._mint(account, amount);
        if (offerExists() && active) {
            offer.adjustVotes(address(0), account, amount);
        }
    } */

    function _transfer(address from, address to, uint256 value) virtual override internal {
        super._transfer(from, to, value);
        if (offerExists() && active) {
            offer.adjustVotes(from, to, value);
        }
    }

    function _burn(address account, uint256 amount) virtual override internal {
        super._burn(account, amount);
        if (offerExists() && active) {
            offer.adjustVotes(account, address(0), amount);
        }
    }

    function offerExists() internal view returns (bool) {
        return address(offer) != address(0);
    }

    modifier offerPending() {
        require(offerExists() && active, "no pending offer");
        _;
    }

    modifier noOfferPending() {
        require(!offerExists(), "offer pending");
        _;
    }

}

abstract contract IShares {
    function totalShares() virtual public returns (uint256);
}

abstract contract IBurnable {
    function burn(uint256) virtual public;
}