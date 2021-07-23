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
pragma solidity >=0.8;

/**
 * @title CompanyName Shareholder Agreement
 * @author Luzius Meisser, luzius@aktionariat.com
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

import "./ERC20.sol";
import "./IERC20.sol";
import "./IERC677Receiver.sol";

contract ERC20Draggable is ERC20, IERC677Receiver {

    IERC20 public wrapped;                              // The wrapped contract
    IOfferFactory public constant factory = IOfferFactory(0xf9f92751F272f0872e2EDb6a280b0990F3e2b8A3);

    uint256 private constant MIGRATION_QUORUM = 8000;

    // If the wrapped tokens got replaced in an acquisition, unwrapping might yield many currency tokens
    uint256 public unwrapConversionFactor = 0;

    // The current acquisition attempt, if any. See initiateAcquisition to see the requirements to make a public offer.
    IOffer public offer;

    uint256 public quorum; // BPS (out of 10'000)
    uint256 public votePeriod; // Seconds

    event MigrationSucceeded(address newContractAddress);

    constructor(
        address wrappedToken,
        uint256 quorum_,
        uint256 votePeriod_
    ) ERC20(0) {
        wrapped = IERC20(wrappedToken);
        quorum = quorum_;
        votePeriod = votePeriod_;
    }

    function disableRecovery() public {
        IRecoveryDisabler(address(wrapped)).setRecoverable(false);
    }

    function name() public override view returns (string memory){
        if (isBinding()){
            return string(abi.encodePacked("Draggable ", wrapped.name()));
        } else {
            return string(abi.encodePacked("Wrapped ", wrapped.name()));
        }
    }

    function symbol() public override view returns (string memory){
        if (isBinding()){
            return string(abi.encodePacked("D", wrapped.symbol()));
        } else {
            return string(abi.encodePacked("W", wrapped.symbol()));
        }
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata) override public returns (bool) {
        require(msg.sender == address(wrapped));
        _mint(from, amount);
        return true;
    }

    /** Increases the number of drag-along tokens. Requires minter to deposit an equal amount of share tokens */
    function wrap(address shareholder, uint256 amount) public {
        require(wrapped.transferFrom(msg.sender, address(this), amount));
        _mint(shareholder, amount);
    }

    /**
     * Indicates that the token holders are bound to the token terms and that:
     * - Conversions back to the wrapped token (unwrap) are not allowed
     * - The drag-along can be performed by making an according offer
     * - They can be migrated to a new version of this contract in accordance with the terms
     */
    function isBinding() public view returns (bool) {
        return unwrapConversionFactor == 0;
    }

    /**
     * Deactivates the drag-along mechanism and enables the unwrap function.
     */
    function deactivate(uint256 factor) internal {
        require(factor >= 1, "factor");
        unwrapConversionFactor = factor;
    }

    /** Decrease the number of drag-along tokens. The user gets back their shares in return */
    function unwrap(uint256 amount) public {
        require(!isBinding());
        unwrap(msg.sender, amount, unwrapConversionFactor);
    }
    
    function unwrap(address owner, uint256 amount, uint256 factor) internal {
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
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
        uint256 factor = isBinding() ? 1 : unwrapConversionFactor;
        IBurnable(address(wrapped)).burn(amount * factor);
    }

    event TimeStamp(uint256 time); // TEMP

    function makeAcquisitionOffer(bytes32 salt, uint256 pricePerShare, address currency) public payable {
        require(isBinding());
        emit TimeStamp(block.timestamp);
        address newOffer = factory.create{value: msg.value}(salt, msg.sender, pricePerShare, currency, quorum, votePeriod);
        if (offerExists()) {
            require(IOffer(newOffer).isWellFunded());
            offer.contest(newOffer);
        }
        offer = IOffer(newOffer);
    }

    function drag(address buyer, address currency) public {
        require(msg.sender == address(offer));
        unwrap(buyer, balanceOf(buyer), 1);
        replaceWrapped(currency, buyer);
    }

    function notifyOfferEnded() public {
        if (msg.sender == address(offer)){
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

    function migrate() public {
        address successor = msg.sender;
        require(!offerExists()); // if you have 80%, you can easily cancel the offer first if necessary
        require(balanceOf(successor) * 10000 >= totalSupply() * MIGRATION_QUORUM, "quorum");
        replaceWrapped(successor, successor);
        emit MigrationSucceeded(successor);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) virtual override internal {
        if (offerExists()) {
            offer.notifyMoved(from, to, amount);
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    function offerExists() internal view returns (bool) {
        return address(offer) != address(0);
    }

}

abstract contract IRecoveryDisabler {
    function setRecoverable(bool enabled) public virtual;
}

abstract contract IBurnable {
    function burn(uint256) virtual public;
}

abstract contract IOffer {
    function isWellFunded() virtual public returns (bool);
    function contest(address newOffer) virtual public;
    function notifyMoved(address from, address to, uint256 value) virtual public;
}

abstract contract IOfferFactory {
    function create(bytes32 salt, address buyer, uint256 pricePerShare, address currency, uint256 quorum, uint256 votePeriod) virtual public payable returns (address);
}