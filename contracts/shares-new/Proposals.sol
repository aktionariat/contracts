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

    // Recovery //
    struct RecoveryProposal {
        address recipient;
        uint256 timestamp;
	}

    uint256 public constant RELEASE_PROPOSAL_DELAY = 20 days;
    
    mapping(address lostAddress => RecoveryProposal recoveryProposal) public recoveryProposals;
    
    error RecoveryNoBalance(address lostAddress);
    error RecoveryExists(address lostAddress);
    error RecoveryNotFound(address lostAddress);
    error RecoveryInvalidRecipient(address recipient);
    error RecoveryInvalidSender(address sender);
    error RecoveryTooEarly(uint256 timestamp);
    
    /**
	 * Current naming convention is to append "S" to the base share ticker.
	 */
	function proposeRecovery(address lostAddress, address recipient) public onlyOwner returns (RecoveryProposal memory recoveryProposal) {
        if (balanceOf(lostAddress) == 0) revert RecoveryNoBalance(lostAddress);
        if (recoveryProposals[lostAddress].timestamp != 0) revert RecoveryExists(lostAddress); 
        if (recipient == address(0) || recipient == lostAddress) revert RecoveryInvalidRecipient(recipient);

        recoveryProposal = RecoveryProposal({ recipient: recipient, timestamp: block.timestamp });
        recoveryProposals[lostAddress] = recoveryProposal;
        return recoveryProposal;
	}

    function cancelRecoveryProposal(address lostAddress) public {
        if (msg.sender != owner && msg.sender != lostAddress) revert RecoveryInvalidSender(msg.sender);
        if (recoveryProposals[lostAddress].timestamp == 0) revert RecoveryNotFound(lostAddress); 
        delete recoveryProposals[lostAddress];
    }

    function executeRecovery(address lostAddress) public {
        RecoveryProposal memory recoveryProposal = recoveryProposals[lostAddress];
        if (recoveryProposal.timestamp == 0) revert RecoveryNotFound(lostAddress); 
        if (block.timestamp < recoveryProposal.timestamp + RELEASE_PROPOSAL_DELAY) revert RecoveryTooEarly(recoveryProposal.timestamp + RELEASE_PROPOSAL_DELAY); 

        delete recoveryProposals[lostAddress];

        _executeRecovery(lostAddress, recoveryProposal.recipient);
    }

    function _executeRecovery(address lostAddress, address recipient) internal virtual;

    // Drag-along

    // Migration

    // Cancellation

    // Modifiers

}
