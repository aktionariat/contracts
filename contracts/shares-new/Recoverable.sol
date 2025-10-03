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

import "./DeterrenceFee.sol";
import "../ERC20/ERC20Flaggable.sol";

abstract contract Recoverable is ERC20Flaggable, DeterrenceFee {

    uint256 public constant RECOVERY_PROPOSAL_DELAY = 45 days;

    mapping(address lostAddress => Recovery recovery) public recoveries;

    struct Recovery {
        address recipient;
        uint24 timestamp;
	}
    
    error RecoveryNoBalance(address lostAddress);
    error RecoveryExists(address lostAddress);
    error RecoveryNotFound(address lostAddress);
    error RecoveryTooEarly(uint256 timestamp);

    event RecoveryInitiated(address lostAddress, address recipient);
    event RecoveryDeleted(address lostAddress);
    event Recovered(address lost, address target, uint256 amount);
    event Burned(address lost, uint256 amount);

    constructor(){
        deterrenceFee = 0.01 ether;
    }

    function initBurn(address target) external onlyOwner returns Recovery {
        initRecovery(target, , address(0x0));
    }

    function initRecovery(address lostAddress) external payable returns Recovery {
        return initRecovery(lostAddress, msg.sender);
    }
    
	function initRecovery(address lostAddress, address recipient) payable returns (Recovery memory recovery) {
        if (balanceOf(lostAddress) == 0) revert RecoveryNoBalance(lostAddress);
        if (recoveries[lostAddress].timestamp != 0) revert RecoveryExists(lostAddress);
        if (msg.sender != owner && deterrenceFee > 0) payDeterrenceFee(); // to deter bad actors

        Recovery = Recovery({ recipient: recipient, timestamp: int24(block.timestamp) });
        recoveries[lostAddress] = recoveryProposal;
        emit RecoveryInitiated(lostAddress, recipient);
        return recoveryProposal;
	}

    function cancelRecovery() external {
        deleteRecovery(msg.sender);
    }

    function cancelRecovery(address lostAddress) public onlyOwner {
        deleteRecovery(lostAddress);
    }

    function deleteRecovery(address lostAddress) internal {
        delete recoveryProposals[lostAddress];
        emit RecoveryDeleted(lostAddress);
    }

    function burn(address lostAddress) external onlyOwner {
        burn(lostAddress, balanceOf(lostAddress));
    }

    /**
     * Burns the indicated number of share tokens on the target address.
     * 
     * Burning tokens can indicate that the underlying shares have been cancelled.
     * But it could also be a preparatory step for re-issuing the shares in a different form
     * or as a new token on a different chain.
     */
    public burn(address lostAddress, uint256 balance) public onlyOwner {
        address target = prepare(lostAddress);
        if (target != address(0x0)) revert NotBurn();
        _burn(lostAddress, balance);
        emit Burned(lostAddress, balance);
    }

    function recover(address lostAddress) external {
        address target = prepare(lostAddress);
        if (target == address(0x0)) revert NotRecovery();
        uint256 balance = balanceOf(lostAddress);
        _transfer(lostAddress, target, balance);
        emit Recovered(lostAddress, target, balance);
    }

    function prepare(address lostAddress) internal returns (address) {
        Recovery memory recovery = recoveries[lostAddress];
        if (recovery.timestamp == 0) revert RecoveryNotFound(lostAddress);
        uint256 deadline = recoveryProposal.timestamp + RECOVERY_PROPOSAL_DELAY;
        if (block.timestamp < deadline) revert RecoveryTooEarly(deadline);
        delete recoveries[lostAddress]; // TODO: check that we can still access recovery.recipient after deletion
        return recovery.recipient;
    }

}