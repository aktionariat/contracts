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


import "./ERC20Flaggable.sol";
import "../utils/Ownable.sol";

/**
 * A very flexible and efficient form to subject ERC-20 tokens to an allowlisting.
 * See ../../doc/allowlist.md for more information.
 */
abstract contract ERC20Allowlistable is ERC20Flaggable, Ownable {

  uint8 private constant TYPE_FREE = 0x0;
  uint8 private constant TYPE_ALLOWED = 0x1;
  uint8 private constant TYPE_RESTRICTED = 0x2;
  uint8 private constant TYPE_ADMIN = 0x4;

  uint8 private constant FLAG_INDEX_ALLOWED = 20;
  uint8 private constant FLAG_INDEX_RESTRICTED = 21;
  uint8 private constant FLAG_INDEX_ADMIN = 22;

  event AddressTypeUpdate(address indexed account, uint8 addressType);

  /// Receiver has flag forbidden.
  /// @param receiver the address of the forbidden receiver.
  error Allowlist_ReceiverIsForbidden(address receiver);
  /// Sender has flag forbidden.
  /// @param sender the address of the forbidden sender.
  error Allowlist_SenderIsForbidden(address sender);
  /// Receiver has no allowlist flag.
  /// @param receiver the address which isn't allowlisted.
  error Allowlist_ReceiverNotAllowlisted(address receiver);

  /**
   * Configures whether the allowlisting is applied.
   * Also sets the powerlist and allowlist flags on the null address accordingly.
   * It is recommended to also deactivate the powerlist flag on other addresses.
   */
  function setApplicable(bool transferRestrictionsApplicable) external onlyOwner {
    setApplicableInternal(transferRestrictionsApplicable);
  }

  /**
   * Sets the 0x0 address to ADMIN, to apply restrictions to newly minted shares.
   * The issuer should decide if existing shares are freely transferable or not.
   * If not, existing holders need to be converted to ALLOWED as well
   */
  function setApplicableInternal(bool transferRestrictionsApplicable) internal {
    if (transferRestrictionsApplicable){
      setTypeInternal(address(0x0), TYPE_ADMIN);
    } else {
      setTypeInternal(address(0x0), TYPE_FREE);
    }
  }

  function setType(address account, uint8 typeNumber) public onlyOwner {
    setTypeInternal(account, typeNumber);
  }

  function setType(address[] calldata addressesToAdd, uint8 typeNumber) public onlyOwner {
    for (uint i = 0 ; i < addressesToAdd.length ; i++){
      setType(addressesToAdd[i], typeNumber);
    }
  }

  /**
   * If TYPE_FREE all flags are set to 0
   */
  function setTypeInternal(address account, uint8 typeNumber) internal {
    setFlag(account, FLAG_INDEX_ALLOWED, typeNumber == TYPE_ALLOWED);
    setFlag(account, FLAG_INDEX_RESTRICTED, typeNumber == TYPE_RESTRICTED);
    setFlag(account, FLAG_INDEX_ADMIN, typeNumber == TYPE_ADMIN);
    emit AddressTypeUpdate(account, typeNumber);
  }

  /**
   * If true, this address is allowlisted and can only transfer tokens to other allowlisted addresses.
   */
  function isAllowed(address account) public view returns (bool) {
    return hasFlagInternal(account, FLAG_INDEX_ALLOWED);
  }

  /**
   * If true, this address can only transfer tokens to admin addresses and not receive from anyone.
   */
  function isRestricted(address account) public view returns (bool){
    return hasFlagInternal(account, FLAG_INDEX_RESTRICTED);
  }

  /**
   * If true, this address can send to any address, except restricted
   * It also automatically allowlists target addresses
   */
  function isAdmin(address account) public view returns (bool) {
    return hasFlagInternal(account, FLAG_INDEX_ADMIN);
  }

  /**
   * Implements the following ruleset.
   * 1. "Restricted" addresses cannot send or receive shares, except sending to an admin address
   * 2. Shares on "Free" addresses are freely transferable
   * 3. "Allowed" addresses can only send to "Allowed" or "Admin" addresses   * 
   * 
   * +------------+-----+-----+-----+-----+
   * |            | Fre | Alw | Res | Adm |
   * +------------+-----+-----+-----+-----+
   * | Free       |  Y  |  Y  |  N  |  Y  |
   * | Allowed    |  N  |  Y  |  N  |  Y  |
   * | Restricted |  N  |  N  |  N  |  Y  |
   * | Admin      |  Y  |  Y  |  N  |  Y  |
   * +------------+-----+-----+-----+-----+
   */

  function _beforeTokenTransfer(address from, address to, uint256 amount) override virtual internal {
    super._beforeTokenTransfer(from, to, amount);

    if (isRestricted(to)) {
        revert Allowlist_ReceiverIsForbidden(to);
    }
    else if (isRestricted(from)) {
      if (!isAdmin(to)) {
        revert Allowlist_SenderIsForbidden(from);
      }
    }
    else if (!isAdmin(to) && !isAllowed(to)) {
      if (isAllowed(from)) {
        revert Allowlist_ReceiverNotAllowlisted(to);
      }

      // Admin address always sets the recipient to ALLOWED
      // If this behaviour is not desired, set admin addresses to FREE instead
      if (isAdmin(from)) {
        setFlag(to, FLAG_INDEX_ALLOWED, true);
        emit AddressTypeUpdate(to, TYPE_ALLOWED);
      }
    }
  }

}
