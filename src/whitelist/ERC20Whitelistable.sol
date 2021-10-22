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


import "../ERC20Flaggable.sol";
import "../Ownable.sol";
import "../IERC677Receiver.sol";

abstract contract ERC20Whitelistable is ERC20Flaggable, IERC677Receiver, Ownable {

  uint8 private constant FLAG_WHITELIST = 100;

  event AdressAddedToWhiteList(address whitelistAddress);
  event AdressRemovedFromWhiteList(address whitelistAddress);


  function addToWhitleList(address newAddress) public onlyOwner{
    if (! hasFlagInternal(newAddress, FLAG_WHITELIST)){
      toggleFlag(newAddress, FLAG_WHITELIST);
      emit AdressAddedToWhiteList(newAddress);
    }
  }

  function addToWhiteList(address[] calldata addressesToAdd) public onlyOwner {
    for (uint i=0; i<addressesToAdd.length; i++){
      addToWhiteList(addressesToAdd);
    }
  }

  function removeFromWhitleList(address addressToRemove) public onlyOwner{
    if (hasFlagInternal(addressToRemove, FLAG_WHITELIST)){
      toggleFlag(addressToRemove, FLAG_WHITELIST);
      emit AdressRemovedFromWhiteList(addressToRemove);
    }
  }
    function removeFromWhitleList(address[] calldata addressesToRemove) public onlyOwner {
    for (uint i=0; i<addressesToRemove.length; i++){
      addToWhiteList(addressesToRemove);
    }
  }

  function isWhitelisted(address addressToCheck) public view returns (bool) {
    return hasFlagInternal(addressToCheck, FLAG_WHITELIST);
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) override virtual internal {
    super._beforeTokenTransfer(from, to, amount);
    if (to != address(0)) {
      require(isWhitelisted(to), "to not whitelisted");
    }
  }

}