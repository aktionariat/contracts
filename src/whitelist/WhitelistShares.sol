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
pragma solidity ^0.8;

import "../recovery/ERC20Recoverable.sol";
import "./ERC20Whitelistable.sol";

contract WhitelistShares is ERC20Whitelistable, ERC20Recoverable{

  string public terms;
  IERC20 public wrapped;
  uint256 public unwrapConversionFactor = 0;

  constructor(
    string memory _terms,
    address _wrappedToken,
    address _recoveryHub,
    address _owner
  )
    ERC20Flaggable(0)
    ERC20Recoverable(_recoveryHub)
    Ownable(_owner) 
  {
    wrapped = IERC20(_wrappedToken);
    terms = _terms; // to update the terms, migrate to a new contract. That way it is ensured that the terms can only be updated when the quorom agrees.
    IRecoveryHub(address(_recoveryHub)).setRecoverable(false); 
  }

  function name() public override view returns (string memory){
    return string(abi.encodePacked(wrapped.name(), " (Wrapped)"));
  }

  function symbol() public override view returns (string memory){
    // ticker should be less dynamic than name
    return string(abi.encodePacked(wrapped.symbol(), "S"));
  }

  function getClaimDeleter() public override view returns (address) {
      return owner;
  }

  function getCollateralRate(address collateralType) public view override returns (uint256) {
    uint256 rate = super.getCollateralRate(collateralType);
    if (rate > 0) {
        return rate;
    } else if (collateralType == address(wrapped)) {
        return unwrapConversionFactor;
    } else {
        // If the wrapped contract allows for a specific collateral, we should too.
        // If the wrapped contract is not IRecoverable, we will fail here, but would fail anyway.
        return IRecoverable(address(wrapped)).getCollateralRate(collateralType) * unwrapConversionFactor;
    }
  }

  function onTokenTransfer(address from, uint256 amount, bytes calldata) override public returns (bool) {
    require(msg.sender == address(wrapped));
    _mint(from, amount);
    return true;
  }

   function transfer(address recipient, uint256 amount) override(ERC20Recoverable, ERC20Flaggable) virtual public returns (bool) {
      return super.transfer(recipient, amount); 
   }

  function _beforeTokenTransfer(address from, address to, uint256 amount) virtual override(ERC20Whitelistable, ERC20Flaggable) internal {
    super._beforeTokenTransfer(from, to, amount);
  }


}