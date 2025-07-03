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

import "../ERC20/ERC20Allowlistable.sol";
import "./DraggableShares.sol";

contract AllowlistDraggableShares is DraggableShares, ERC20Allowlistable {

  constructor(
    string memory _terms,
    DraggableParams memory _params,
    IRecoveryHub _recoveryHub,
    IOfferFactory _offerFactory,
    address _oracle,
    Permit2Hub _permit2Hub
  )
    DraggableShares(_terms, _params, _recoveryHub, _offerFactory, _oracle, _permit2Hub)
    Ownable(_oracle)
  {
    // initialization is done in ERC20Allowlistbale and DraggableShares
  }

  function transfer(address to, uint256 value) virtual override(ERC20Flaggable, DraggableShares) public returns (bool) {
      return super.transfer(to, value);
  }
  
  function _beforeTokenTransfer(address from, address to, uint256 amount) virtual override(ERC20Allowlistable, DraggableShares) internal {
    super._beforeTokenTransfer(from, to, amount);
  }

    function allowance(address owner, address spender) public view override(DraggableShares, ERC20Flaggable) returns (uint256) {
        return super.allowance(owner,spender);
  }

}