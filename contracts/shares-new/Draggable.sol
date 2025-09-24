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

abstract contract Draggable is ERC20Flaggable, Ownable {

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
    error DragAlongExists(DragAlongProposal dragAlongProposal);
    error DragAlongNotFound();
    error DragAlongNoVetoPower();
    error DragAlongTooEarly(uint256 timestamp);

    function proposeDragAlong(address buyer, address currencyToken, uint256 pricePerShare) public onlyOwner returns (DragAlongProposal memory) {
        if (dragAlongProposal.buyer != address(0)) revert DragAlongExists(dragAlongProposal); 
        if (buyer == address(0)) revert DragAlongInvalidBuyer(); 
        if (currencyToken == address(0)) revert DragAlongInvalidCurrency(); 

        dragAlongProposal = DragAlongProposal({ buyer: buyer, timestamp: block.timestamp, currencyToken: currencyToken, pricePerShare: pricePerShare });

        return dragAlongProposal;
	}

    function cancelDragAlong() public {
        if (dragAlongProposal.buyer == address(0)) revert DragAlongNotFound(); 
        if (msg.sender != owner && !hasPercentageOfSupply(msg.sender, 10)) revert DragAlongNoVetoPower();

        delete dragAlongProposal;
    }
    
    function executeDragAlong() public {
        uint256 deadline = dragAlongProposal.timestamp + DRAG_PROPOSAL_DELAY;
        if (dragAlongProposal.buyer == address(0)) revert DragAlongNotFound(); 
        if (block.timestamp < deadline && !hasPercentageOfSupply(dragAlongProposal.buyer, 90) && !hasPercentageOfSupply(msg.sender, 90)) revert DragAlongTooEarly(deadline); 

        // Delete before execute to protect agains reentrancy
        DragAlongProposal memory _dragAlongProposal = dragAlongProposal;
        delete dragAlongProposal;

        _executeDragAlong(_dragAlongProposal.buyer, _dragAlongProposal.currencyToken, _dragAlongProposal.pricePerShare);
    }

    function hasPercentageOfSupply(address owner, uint256 percentage) public view returns (bool) {
        return balanceOf(owner) * 100 >= totalSupply() * percentage;
    }

    // Must be implemented by the inheriting contract, since the implementation can vary to account for wrapping.
    function _executeDragAlong(address buyer, address currencyToken, uint256 pricePerShare) internal virtual;
}