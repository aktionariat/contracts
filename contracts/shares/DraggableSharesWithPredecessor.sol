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
pragma solidity 0.8.29;

import "./DraggableShares.sol";
/** 
 *  
 * @dev Use this contract if you need to migrate the predecessor tokens with the majority of shares onchain.
 */
contract DraggableSharesWithPredecessor is DraggableShares {
  IDraggable immutable predecessor;


  constructor(
    IDraggable _predecessor,
    string memory _terms,
    DraggableParams memory _params,
    IRecoveryHub _recoveryHub,
    IOfferFactory _offerFactory,
    address _oracle,
    Permit2Hub _permit2Hub
  )
    DraggableShares(_terms, _params, _recoveryHub, _offerFactory, _oracle, _permit2Hub)
  {
    predecessor = _predecessor;
  }
  
  /**
   * @notice This contract needs to hold the majority of the predecessor tokens.
   */
  function initiateMigration() external {
    uint256 predecessorSupply = predecessor.totalSupply();
    _mint(address(predecessor), predecessorSupply);
    wrapped = predecessor.wrapped();
    predecessor.migrate();
    uint256 predecessorBalance = predecessor.balanceOf(address(this));
    predecessor.unwrap(predecessorBalance);
    _burn(address(this), predecessorBalance);
    assert(predecessorSupply == totalSupply());
  }
}