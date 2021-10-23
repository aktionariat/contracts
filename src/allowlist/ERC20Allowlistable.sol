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

/**
 * 
 */
abstract contract ERC20Allowlistable is ERC20Flaggable, Ownable {

  uint8 private constant TYPE_DEFAULT = 0x0;
  uint8 private constant TYPE_ALLOWLISTED = 0x1;
  uint8 private constant TYPE_FORBIDDEN = 0x2;

  uint8 private constant FLAG_INDEX_ALLOWLIST = 20;
  uint8 private constant FLAG_INDEX_FORBIDDEN = 21;
  uint8 private constant FLAG_INDEX_POWERLIST = 22;

  event AddressTypeUpdate(address indexed whitelistAddress, uint8 addressType);

  bool public restrictTransfers;

  constructor(){
    setApplicableInternal(true);
  }

  /**
   * Configures whether the allowlisting is applied.
   * Also sets the powerlist and allowlist flags on the null address accordingly.
   * It is recommended to do the same for any company address that distributes tokens.
   */
  function setApplicable(bool transferRestrictionsApplicable) public onlyOwner {
    setApplicableInternal(transferRestrictionsApplicable);
  }

  function setApplicableInternal(bool transferRestrictionsApplicable) internal {
    restrictTransfers = true;
    // if transfer restrictions are applied, we guess that should also be the case for newly minted tokens
    // if the admin disagrees, it is still possible to change the type of the null address
    if (transferRestrictionsApplicable){
      setType(address(0x0), TYPE_ALLOWLISTED);
    } else {
      setType(address(0x0), TYPE_DEFAULT);
    }
    setFlag(address(0x0), FLAG_INDEX_POWERLIST, transferRestrictionsApplicable);
  }

  /**
   * Sets the "powerlist" flag for the given address.
   * Powerlisted addresses can send tokens to any other address and automatically
   * allowlist them in the process.
   * 
   * If you want to enable automatic allowlisting for newly minted tokens, the null address
   * should be powerlisted.
   */
  function powerlist(address account, bool value) public onlyOwner {
    setFlag(account, FLAG_INDEX_POWERLIST, value);
  }

  function setType(address newAddress, uint8 typeNumber) public onlyOwner {
    setFlag(newAddress, FLAG_INDEX_ALLOWLIST, typeNumber == TYPE_ALLOWLISTED);
    setFlag(newAddress, FLAG_INDEX_FORBIDDEN, typeNumber == TYPE_FORBIDDEN);
    emit AddressTypeUpdate(newAddress, typeNumber);
  }

  function setType(address[] calldata addressesToAdd, uint8 value) public onlyOwner {
    for (uint i=0; i<addressesToAdd.length; i++){
      setType(addressesToAdd, value);
    }
  }

  /**
   * If true, this address is allowlisted.
   */
  function isAllowlisted(address account) public view returns (bool) {
    return hasFlagInternal(account, FLAG_INDEX_ALLOWLIST);
  }

  /**
   * If true, this address can only transfer tokens to allowlisted addresses.
   */
  function isForbidden(address account) internal view returns (bool){
    return hasFlagInternal(account, FLAG_INDEX_FORBIDDEN);
  }

  /**
   * If true, this address can automatically allowlist target addresses if necessary.
   */
  function isPowerlisted(address account) public view returns (bool) {
    return hasFlagInternal(account, FLAG_INDEX_POWERLIST);
  }

  /**
   * Cleans the allowlist and disallowlist flag under the assumption that the
   * allowlisting is not applicable any more.
   */
  function cleanup(address account) internal {
    require(!restrictTransfers && !isForbidden(account), "not allowed");
    setType(account, TYPE_DEFAULT);
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) override virtual internal {
    super._beforeTokenTransfer(from, to, amount);
    require(!isForbidden(to), "forbidden"); // transferring to forbidden addresses is never allowed
    if (isAllowlisted(to)){
      // ok, transfers to allowlisted addresses are always allowed
    } else if (isAllowlisted(from) || isForbidden(from)){
      // this is not an allowed transfer, but maybe we can make it one?
      if (isPowerlisted(from)){
        setType(to, TYPE_ALLOWLISTED);
        // yes, we do! Now this is an allowlisted to allowlisted transfer
      } else {
        cleanup(from);
        // yes, we do! Now this is a transfer between free addresses
      }
    } else {
      // ok, transfer between free addresses
    }
  }

}