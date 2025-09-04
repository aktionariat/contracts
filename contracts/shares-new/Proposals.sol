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
 * This contract manages token actions that are executed through a propose-execute mechanism.
 * An onchain quorum requirement is purposefully avoided due to the possible presence of non-tokenized shares.
 * Instead, the proposer is assumed to have the necessary offchain mandate and quorum to execute the proposal.
 */

import "../ERC20/ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract Proposals is ERC20Flaggable, Ownable {

    /************
     * RECOVERY *
     ************
     * 
     * Recover tokens on a lost address to a new recipient address.
     * The recovery has to be proposed by the contract owner and can then be executed with a 20 day delay.
     * It can be cancelled by the contract owner or the owner of the "lost" address at any time before execution.
     */

    struct RecoveryProposal {
        address recipient;
        uint256 timestamp;
	}

    uint256 public constant RECOVERY_PROPOSAL_DELAY = 20 days;
    
    mapping(address lostAddress => RecoveryProposal recoveryProposal) public recoveryProposals;
    
    error RecoveryNoBalance(address lostAddress);
    error RecoveryExists(address lostAddress);
    error RecoveryNotFound(address lostAddress);
    error RecoveryInvalidRecipient(address recipient);
    error RecoveryInvalidSender(address sender);
    error RecoveryTooEarly(uint256 timestamp);
    
	function proposeRecovery(address lostAddress, address recipient) public onlyOwner returns (RecoveryProposal memory recoveryProposal) {
        if (balanceOf(lostAddress) == 0) revert RecoveryNoBalance(lostAddress);
        if (recoveryProposals[lostAddress].timestamp != 0) revert RecoveryExists(lostAddress); 
        if (recipient == address(0) || recipient == lostAddress) revert RecoveryInvalidRecipient(recipient);

        recoveryProposal = RecoveryProposal({ recipient: recipient, timestamp: block.timestamp });
        recoveryProposals[lostAddress] = recoveryProposal;
        return recoveryProposal;
	}

    function cancelRecovery(address lostAddress) public {
        if (msg.sender != owner && msg.sender != lostAddress) revert RecoveryInvalidSender(msg.sender);
        if (recoveryProposals[lostAddress].timestamp == 0) revert RecoveryNotFound(lostAddress); 
        delete recoveryProposals[lostAddress];
    }

    function executeRecovery(address lostAddress) public {
        RecoveryProposal memory recoveryProposal = recoveryProposals[lostAddress];
        if (recoveryProposal.timestamp == 0) revert RecoveryNotFound(lostAddress); 
        uint256 deadline = recoveryProposal.timestamp + RECOVERY_PROPOSAL_DELAY;
        if (block.timestamp < deadline) revert RecoveryTooEarly(deadline); 

        delete recoveryProposals[lostAddress];

        _executeRecovery(lostAddress, recoveryProposal.recipient);
    }

    function _executeRecovery(address lostAddress, address recipient) internal virtual {
        _transfer(lostAddress, recipient, balanceOf(lostAddress));
    }


    /************
     * BURN *
     ************
     * 
     * Burn the wrapped tokens on an address. The corresponding base shares are also burned.
     * The burn has to be proposed by the contract owner and can then be executed with a 20 day delay.
     * It can be cancelled by the contract owner or the owner of the "burn" address at any time before execution.
     */

    uint256 public constant BURN_PROPOSAL_DELAY = 20 days;
    
    mapping(address burnAddress => uint256 timestamp) public burnProposals;
    
    error BurnNoBalance(address burnAddress);
    error BurnExists(address burnAddress);
    error BurnInvalidSender(address sender);
    error BurnNotFound(address burnAddress);
    error BurnTooEarly(uint256 timestamp);

	function proposeBurn(address burnAddress) public onlyOwner returns (address, uint256 time) {
        if (balanceOf(burnAddress) == 0) revert BurnNoBalance(burnAddress);
        if (burnProposals[burnAddress] != 0) revert BurnExists(burnAddress); 

        burnProposals[burnAddress] = block.timestamp;
        return (burnAddress, block.timestamp);
	}

    function cancelburn(address burnAddress) public {
        if (msg.sender != owner && msg.sender != burnAddress) revert BurnInvalidSender(msg.sender);
        if (burnProposals[burnAddress] == 0) revert BurnNotFound(burnAddress); 

        delete burnProposals[burnAddress];
    }

    function executeBurn(address burnAddress) public {
        if (burnProposals[burnAddress] == 0) revert BurnNotFound(burnAddress); 
        uint256 deadline = burnProposals[burnAddress] + BURN_PROPOSAL_DELAY;
        if (block.timestamp < deadline) revert BurnTooEarly(deadline); 

        delete burnProposals[burnAddress];

        _executeBurn(burnAddress);
    }

    // Must be implemented by the inheriting contract, since the implementation can vary to account for wrapping.
    function _executeBurn(address burnAddress) internal virtual;


    ////////////////
    // Drag-along //
    ////////////////

    struct DragAlongProposal {
        address buyer;
        uint256 timestamp;
        address currencyToken;
        uint256 pricePerShare;
	}

    uint256 public constant DRAG_PROPOSAL_DELAY = 20 days;
    DragAlongProposal public dragAlongProposal;
    
    error DragAlongInvalidBuyer();
    error DragAlongInvalidCurrency();
    error DragAlongOfferExists(DragAlongProposal dragAlongProposal);
    error DragAlongOfferNotFound();
    error DragAlongOfferNoVetoPower();

    function proposeDragAlong(address buyer, address currencyToken, uint256 pricePerShare) public onlyOwner returns (DragAlongProposal memory) {
        if (dragAlongProposal.buyer != address(0)) revert DragAlongOfferExists(dragAlongProposal); 
        if (buyer == address(0)) revert DragAlongInvalidBuyer(); 
        if (currencyToken == address(0)) revert DragAlongInvalidCurrency(); 

        dragAlongProposal = DragAlongProposal({ buyer: buyer, timestamp: block.timestamp, currencyToken: currencyToken, pricePerShare: pricePerShare });

        return dragAlongProposal;
	}

    function cancelDragAlong() public {
        if (dragAlongProposal.buyer == address(0)) revert DragAlongOfferNotFound(); 
        if (msg.sender != owner && !hasPercentageOfSupply(msg.sender, 10)) revert DragAlongOfferNoVetoPower();

        delete dragAlongProposal;


    }

    // Migration

    // Cancellation

    // Modifiers

    // Helpers

    function hasPercentageOfSupply(address owner, uint256 percentage) public view returns (bool) {
        return balanceOf(owner) * 100 >= totalSupply() * percentage;
    }

}
