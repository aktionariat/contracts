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
    /// @notice Sequentail Flag indexes (types), then casted to indexed
    ///         within setTypeInternal
    /// @notice flag type of Free addresses
    uint8 public constant TYPE_FREE = 0x0;
    /// @notice flag type of Allowed addresses
    uint8 public constant TYPE_ALLOWED = 0x1;
    /// @notice flag type of Restricted addresses
    uint8 public constant TYPE_RESTRICTED = 0x2;
    /// @notice flag type of Admin addresses
    uint8 public constant TYPE_ADMIN = 0x4;

    /// @notice Flag indexes must lie within [0, 31]
    /// @dev flag index of Allowed addresses
    uint8 private constant FLAG_INDEX_ALLOWED = 20;
    /// @dev flag index of Restricted addresses
    uint8 private constant FLAG_INDEX_RESTRICTED = 21;
    /// @dev flag index of Admin addresses
    uint8 private constant FLAG_INDEX_ADMIN = 22;

    /// @notice Global Flag indexes must lie within [0, 256]
    /// @dev Global pause flag index
    uint8 private constant GLOBAL_FLAG_INDEX_PAUSED = 100;

    event AddressTypeUpdate(address indexed account, uint8 addressType);

    event Paused();
    event Unpaused();

    error TransfersPaused();

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
     * Configures newly minted shares to be subject to transfer restrictions, whereas the first
     * recipient is automatically allowlisted.
     *
     * In the background, this is achieved by configuring the null address as ADMIN.
     * 
     * @param transferRestrictionsApplicable whether apply or not restrictions, ture to apply and false otherwise.
     */
    function setApplicable(bool transferRestrictionsApplicable) external onlyOwner {
        if (transferRestrictionsApplicable) {
            setTypeInternal(address(0x0), TYPE_ADMIN);
        } else {
            setTypeInternal(address(0x0), TYPE_FREE);
        }
    }

    /**
     * Freezes an address, that is, makes it restricted 
     * 
     * @param account the address which to restrict
     */
    function freeze(address account) public onlyOwner {
        setTypeInternal(account, TYPE_RESTRICTED);
    }

    /**
     * Unfreezes an address, that is, makes it default type
     * 
     * @notice default type means the allowlist type of the null address
     * 
     * @param account the address which to restrict
     */
    function unfreeze(address account) public onlyOwner {
        setTypeInternal(account, defaultType());
    }

    /**
     * The default type assigned to empty addresses that receive newly minted tokens.
     * Also used as the neutral type when unfreezing an address.
     */
    function defaultType() public view returns (uint8) {
        if (_hasFlag(address(0x0), FLAG_INDEX_ADMIN)) {
            return TYPE_ALLOWED;
        } else {
            return TYPE_FREE;
        }
    }

    /**
     * Set Allowlist flag type to an address. Only owner function
     * 
     * @param account the address which to set the Allowlist flag to
     * @param typeNumber the allowlist flag to be added
     */
    function setType(address account, uint8 typeNumber) public onlyOwner {
        setTypeInternal(account, typeNumber);
    }

    /**
     * Batch version of setType
     * 
     * @param addressesToAdd addresses which to set the Allowlist flag to
     * @param typeNumber the allowlist flag to be added
     */
    function setType(address[] calldata addressesToAdd, uint8 typeNumber) public onlyOwner {
        for (uint i = 0; i < addressesToAdd.length; i++) {
            setType(addressesToAdd[i], typeNumber);
        }
    }

    /**
     * Utils to set any Allowlist type to addresses in a single call
     * 
     * @notice If TYPE_FREE all flags are set to 0
     * 
     * @param account account which the flag is to be set for
     * @param typeNumber the Allowlist type
     */
    function setTypeInternal(address account, uint8 typeNumber) internal {
        _setFlag(account, FLAG_INDEX_ALLOWED, typeNumber == TYPE_ALLOWED);
        _setFlag(account, FLAG_INDEX_RESTRICTED, typeNumber == TYPE_RESTRICTED);
        _setFlag(account, FLAG_INDEX_ADMIN, typeNumber == TYPE_ADMIN);
        emit AddressTypeUpdate(account, typeNumber);
    }

    /**
     * From an address returns whether it is an Allowed address or not
     * 
     * @notice If true, this address is allowlisted and can only transfer tokens to other
     *          allowlisted addresses.
     * 
     * @param account the account to be queried
     * @return bool indicating if the allowed flag is set
     */
    function isAllowed(address account) public view returns (bool) {
        return _hasFlag(account, FLAG_INDEX_ALLOWED);
    }

    /**
     * From an address returns whether it is a Restricted address or not
     * 
     * @notice If true, this address can only transfer tokens to admin addresses and not receive
     *          from anyone.
     * 
     * @param account the account to be queried
     * @return bool indicating if the restricted flag is set
     */
    function isRestricted(address account) public view returns (bool) {
        return _hasFlag(account, FLAG_INDEX_RESTRICTED);
    }

    /**
     * From an address returns whether it is an Admin address or not
     * 
     * @notice If true, this address can send to any address, except restricted
     * It also automatically allowlists target addresses
     * 
     * @param account the account to be queried
     * @return bool indicating if the admin flag is set
     */
    function isAdmin(address account) public view returns (bool) {
        return _hasFlag(account, FLAG_INDEX_ADMIN);
    }

    /**
     * Pauses the contract globally. While paused, all transfers (including mints, burns, migrations,
     * and recoveries) revert with Paused(). Reversible via 'unpause'.
     */
    function pause() external onlyOwner {
        _setGlobalFlag(GLOBAL_FLAG_INDEX_PAUSED, true);
        emit Paused();
    }

    /**
     * Lifts the global pause set via 'pause'.
     */
    function unpause() external onlyOwner {
        _setGlobalFlag(GLOBAL_FLAG_INDEX_PAUSED, false);
        emit Unpaused();
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
     * 
     * @notice Any transfer of admin sets the reciever to Allowed, except if at least one of:
     *          - The transfer amount is zero
     *          - The receipient (to) is a contract
     *          - The receipient (to) is the zero address
     *          is not true.
     * 
     * @param from the address the amunt it is transfered from
     * @param to the address the amount is transfered to
     * @param amount the amount being transferred
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if (_hasGlobalFlag(GLOBAL_FLAG_INDEX_PAUSED)) revert TransfersPaused();
        // can be transfered

        if (isRestricted(to)) {
            // TO Res doesn't accept any user transfer (Res col)

            revert Allowlist_ReceiverIsForbidden(to);
        } else if (isRestricted(from)) {
            // FROM Res allows only from admin (Res row)

            if (!isAdmin(to)) {
                revert Allowlist_SenderIsForbidden(from);
            }
        } else if (!isAdmin(to) && !isAllowed(to)) {
            // TO Free allows only from free or admin

            if (isAllowed(from)) {
                revert Allowlist_ReceiverNotAllowlisted(to);
            }

            // Admin address always sets the recipient to ALLOWED
            // If this behaviour is not desired, set admin addresses to FREE instead
            if (
                // ALLOWED is applied iff
                isAdmin(from) // sender is admin
                && amount != 0 // it is not a zero transfer -> same meaning as using a setter
                && address(to).code.length == 0  // receiver is not a contract
                && to != address(0) // receiver is not address zero
            ) {
                _setFlag(to, FLAG_INDEX_ALLOWED, true);
                emit AddressTypeUpdate(to, TYPE_ALLOWED);
            }
        }
    }
}
