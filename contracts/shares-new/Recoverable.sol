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
 * This contract manages recovery of tokens on a lost address to a new recipient address.
 * The recovery has to be proposed by the contract owner and can then be executed with a 20 day delay.
 * It can be cancelled by the contract owner or the owner of the "lost" address at any time before execution.
 */

import "../ERC20/ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract Recoverable is ERC20Flaggable, Ownable {

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
}