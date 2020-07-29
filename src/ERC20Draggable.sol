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

    IERC20 private wrapped;                        // The wrapped contract

    // If the wrapped tokens got replaced in an acquisition, unwrapping might yield many currency tokens
    uint256 public unwrapConversionFactor = 1;

    // The current acquisition attempt, if any. See initiateAcquisition to see the requirements to make a public offer.
    Acquisition public offer;

    IERC20 private currency;

    address public licenseFeeRecipient;    // Recipient of the fee. Fee makes sure the offer is serious.

    uint256 public licenseFee;             // Fee of 5000 XCHF
    uint256 public migrationQuorum;        // Number of tokens that need to be migrated to complete migration
    uint256 public acquisitionQuorum;

    uint256 constant MIN_OFFER_INCREMENT = 10500;  // New offer must be at least 105% of old offer
    uint256 constant MIN_HOLDING = 500;            // Need at least 5% of all drag along tokens to make an offer
    uint256 constant MIN_DRAG_ALONG_QUOTA = 3000;  // 30% of the equity needs to be represented by drag along tokens for an offer to be made

    bool public active = true;                     // True as long as this contract is legally binding and the wrapped tokens are locked.

    event OfferCreated(address indexed buyer, uint256 pricePerShare, address offerContract);
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
        uint256 acquisitionQuorum_,
        address currencyAddress
    ) ERC20(0) public {
        wrapped = IERC20(wrappedToken);
        licenseFeeRecipient = 0x29Fe8914e76da5cE2d90De98a64d0055f199d06D; // Aktionariat AG
        licenseFee = 5000 * (10**18);   // License fee charged when initiating an offer. Also ensures that the offer is serious.
        migrationQuorum = migrationQuorumInBIPS_;
        acquisitionQuorum = acquisitionQuorum_;
        currency = IERC20(currencyAddress);
        IShares(wrappedToken).totalShares();
    }

    function name() public override view returns (string memory){
        return string(abi.encodePacked("Draggable ", wrapped.name()));
    }

    function symbol() public override view returns (string memory){
        return string(abi.encodePacked("D", wrapped.symbol()));
    }

    function getWrappedContract() public view returns (address) {
        return address(wrapped);
    }

    function getCurrencyContract() public view returns (address) {
        return address(currency);
    }

    function updateCurrency(address newCurrency) public noOfferPending () {
        require(active, "Contract is not active");
        require(IMigratable(getCurrencyContract()).migrationToContract() == newCurrency, "Invalid currency update");
        currency = IERC20(newCurrency);
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata) override public {
        require(msg.sender == address(wrapped));
        dowrap(from, amount);
    }

    /** Increases the number of drag-along tokens. Requires minter to deposit an equal amount of share tokens */
    function wrap(address shareholder, uint256 amount) public noOfferPending() {
        require(wrapped.transferFrom(msg.sender, address(this), amount), "Share transfer failed");
        dowrap(shareholder, amount);
    }

    function dowrap(address shareholder, uint256 amount) internal noOfferPending() {
        require(active, "Contract not active any more.");
        _mint(shareholder, amount);
    }

    /** Decrease the number of drag-along tokens. The user gets back their shares in return */
    function unwrap(uint256 amount) public {
        require(!active, "As long as the contract is active, you are bound to it");
        _burn(msg.sender, amount);
        require(wrapped.transfer(msg.sender, amount.mul(unwrapConversionFactor)), "Share transfer failed");
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
        IBurnable(getWrappedContract()).burn(amount.mul(unwrapConversionFactor));
    }

  /** @dev Function to start drag-along procedure
   *  This can be called by anyone, but there is an upfront payment.
   */
    function initiateAcquisition(uint256 pricePerShare) public {
        require(active, "An accepted offer exists");
        uint256 totalEquity = IShares(getWrappedContract()).totalShares();
        address buyer = msg.sender;

        require(totalSupply() >= totalEquity.mul(MIN_DRAG_ALONG_QUOTA).div(10000), "This contract does not represent enough equity");
        require(balanceOf(buyer) >= totalEquity.mul(MIN_HOLDING).div(10000), "You need to hold at least 5% of the firm to make an offer");

        require(currency.transferFrom(buyer, licenseFeeRecipient, licenseFee), "Currency transfer failed");

        Acquisition newOffer = new Acquisition(msg.sender, pricePerShare, acquisitionQuorum);
        require(newOffer.isWellFunded(getCurrencyContract(), totalSupply() - balanceOf(buyer)), "Insufficient funding");
        if (offerExists()) {
            require(pricePerShare >= offer.price().mul(MIN_OFFER_INCREMENT).div(10000), "New offers must be at least 5% higher than the pending offer");
            killAcquisition("Offer was replaced by a higher bid");
        }
        offer = newOffer;

        emit OfferCreated(buyer, pricePerShare, getPendingOffer());
    }

    function voteYes() public offerPending() {
        address voter = msg.sender;
        offer.voteYes(voter, balanceOf(voter));
    }

    function voteNo() public offerPending() {
        address voter = msg.sender;
        offer.voteNo(voter, balanceOf(voter));
    }

    function cancelAcquisition() public offerPending() {
        require(msg.sender == offer.buyer(), "You are not authorized to cancel this acquisition offer");
        killAcquisition("Cancelled by buyer");
    }

    function contestAcquisition() public offerPending() {
        if (offer.hasExpired()) {
            killAcquisition("Offer expired");
        } else if (offer.quorumHasFailed()) {
            killAcquisition("Not enough support");
        } else if (
            !offer.isWellFunded(
                getCurrencyContract(),
                totalSupply().sub(balanceOf(offer.buyer()))
                )
            ) {
            killAcquisition("Offer was not sufficiently funded");
        } else {
            revert("Acquisition contest unsuccessful");
        }
    }

    function killAcquisition(string memory message) internal {
        address buyer = offer.buyer();
        emit OfferEnded(
            buyer,
            msg.sender,
            false,
            message,
            getPendingOffer()
        );
        offer.kill();
        offer = Acquisition(address(0));
    }

    function completeAcquisition() public offerPending() {
        address buyer = offer.buyer();
        require(msg.sender == buyer, "You are not authorized to complete this acquisition offer");
        require(offer.isQuorumReached(), "Insufficient number of yes votes");
        require(
            offer.isWellFunded(
            getCurrencyContract(),
            totalSupply().sub(balanceOf(buyer))),
            "Offer insufficiently funded"
            );
        invertHoldings(buyer, currency, offer.price());
        emit OfferEnded(
            buyer,
            msg.sender,
            true,
            "Completed successfully",
            address(offer)
        );
    }

    function wasAcquired() public view returns (bool) {
        return offerExists() ? !active : false;
    }

    function invertHoldings(address newOwner, IERC20 newBacking, uint256 conversionRate) internal {
        uint256 buyerBalance = balanceOf(newOwner);
        uint256 initialSupply = totalSupply();
        active = false;
        unwrap(buyerBalance);
        uint256 remaining = initialSupply.sub(buyerBalance);
        require(wrapped.transfer(newOwner, remaining), "Wrapped token transfer failed");
        require(newBacking.transferFrom(newOwner, address(this), conversionRate.mul(remaining)), "Backing transfer failed");

        wrapped = newBacking;
        unwrapConversionFactor = conversionRate;
    }

    function migrate() public {
        require(active, "Contract is not active");
        address successor = msg.sender;
        require(balanceOf(successor) >= totalSupply().mul(migrationQuorum).div(10000), "Quorum not reached");

        if (offerExists()) {
            if (!offer.quorumHasFailed()) {
                voteNo(); // should shut down the offer
                require(offer.quorumHasFailed(), "Quorum has not failed");
            }
            contestAcquisition();
            assert (!offerExists());
        }

        invertHoldings(successor, IERC20(successor), 1);
        emit MigrationSucceeded(successor);
    }

    function _mint(address account, uint256 amount) virtual override internal {
        super._mint(account, amount);
        if (offerExists() && active) {
            // never executed in the default implementation as wrap requires no offer
            offer.adjustVotes(address(0), account, amount);
        }
    }

    function _transfer(address from, address to, uint256 value) virtual override internal {
        super._transfer(from, to, value);
        if (offerExists() && active) {
            offer.adjustVotes(from, to, value);
        }
    }

    function _burn(address account, uint256 amount) virtual override internal {
        require(balanceOf(msg.sender) >= amount, "Balance insufficient");
        super._burn(account, amount);
        if (offerExists() && active) {
            offer.adjustVotes(account, address(0), amount);
        }
    }

    function getPendingOffer() public view returns (address) {
        return address(offer);
    }

    function offerExists() public view returns (bool) {
        return getPendingOffer() != address(0);
    }

    modifier offerPending() {
        require(offerExists() && active, "There is no pending offer");
        _;
    }

    modifier noOfferPending() {
        require(!offerExists(), "There is a pending offer");
        _;
    }

}

abstract contract IShares {
    function totalShares() virtual public returns (uint256);
}

abstract contract IBurnable {
    function burn(uint256) virtual public;
}