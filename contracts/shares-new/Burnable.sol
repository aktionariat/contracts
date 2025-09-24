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
 * Burn the wrapped tokens on an address. The corresponding base shares are also burned.
 * The burn has to be proposed by the contract owner and can then be executed with a 20 day delay.
 * It can be cancelled by the contract owner or the owner of the "burn" address at any time before execution.
 */

import "../ERC20/ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract Burnable is ERC20Flaggable, Ownable {

    struct BurnProposal {
        uint256 amount;
        uint256 timestamp;
	}

    uint256 public constant BURN_PROPOSAL_DELAY = 20 days;
    
    mapping(address burnAddress => BurnProposal burnProposal) public burnProposals;
    
    error BurnInvalidBalance(address burnAddress);
    error BurnExists(address burnAddress);
    error BurnInvalidSender(address sender);
    error BurnNotFound(address burnAddress);
    error BurnTooEarly(uint256 timestamp);

	function proposeBurn(address burnAddress, uint256 amount) public onlyOwner returns (BurnProposal memory burnProposal) {
        if (amount == 0 || balanceOf(burnAddress) == 0 || amount > balanceOf(burnAddress)) revert BurnInvalidBalance(burnAddress);
        if (burnProposals[burnAddress].timestamp != 0) revert BurnExists(burnAddress); 

        burnProposal = BurnProposal({ amount: amount, timestamp: block.timestamp });
        burnProposals[burnAddress] = burnProposal;
        return burnProposal;
	}

    function cancelBurn(address burnAddress) public {
        if (msg.sender != owner && msg.sender != burnAddress) revert BurnInvalidSender(msg.sender);
        if (burnProposals[burnAddress].timestamp == 0) revert BurnNotFound(burnAddress); 

        delete burnProposals[burnAddress];
    }

    function executeBurn(address burnAddress) public {
        BurnProposal memory burnProposal = burnProposals[burnAddress];
        if (burnProposal.timestamp == 0) revert BurnNotFound(burnAddress); 
        uint256 deadline = burnProposal.timestamp + BURN_PROPOSAL_DELAY;
        if (block.timestamp < deadline) revert BurnTooEarly(deadline); 

        delete burnProposals[burnAddress];

        _executeBurn(burnAddress, burnProposal.amount);
    }

    // Must be implemented by the inheriting contract
    function _executeBurn(address burnAddress, uint256 amount) internal virtual;
}