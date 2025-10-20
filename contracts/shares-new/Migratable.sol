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
 * Migrate to a new contract. Meaning can depend on the token to be migrated.
 * - Upgrades
 * Draggable tokens can be "upgraded" by replacing the underlying with a new contract.
 * In this case, users are expected to unwrap to the new token by themselves.
 * - Cancellation / Detokenization
 * In case of a cancellation of the SHA or detokenization, the underlying can be
 * replaced by a shell contract, such as ERC20Cancelled.
 */

import "../ERC20/ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract Migratable is ERC20Flaggable, Ownable {

    uint8 public constant TYPE_DEFAULT = 0x1;
    uint8 public constant TYPE_INTERNAL = 0x2;
    uint8 public constant TYPE_TERMINATION = 0x3;
    uint8 public constant TYPE_CANCELLATION = 0x4;

    struct Migration {
        IERC20 successor;
        uint64 timestamp;
        uint8 migrationType;
	}

    uint256 public constant MIGRATION_PROPOSAL_DELAY = 20 days;
    Migration public migration;

    error MigrationNotFound();
    error MigrationNoVetoPower();
    error MigrationTooEearly(uint256 earliest, uint256 timenow);

    event MigrationProposed(address sender, IERC20 successor, uint8 migrationType);
    event MigrationCancelled(address sender);
    event MigrationExecuted(address sender, IERC20 newBase, uint8 migrationType);
    
    /**
     * The issuer or holders with 10% of the tokens can propose a migration to a new contract.
     */
    function proposeMigration(IERC20 successor) external returns (Migration memory) {
        return _propose(successor, TYPE_DEFAULT);
    }

    function _propose(IERC20 successor, uint8 migrationType) internal returns (Migration memory) {
        if (!canCancelMigration(msg.sender)) revert MigrationNoVetoPower();
        migration = Migration({ successor: successor, timestamp: uint64(block.timestamp), migrationType: migrationType });
        emit MigrationProposed(msg.sender, successor, migrationType);
        return migration;
	}

    /**
     * Propose a termination of the shareholder agreement.
     */
    function proposeTermination() external returns (Migration memory) {
        // When terminating, the new base is the old base
        return _propose(baseToken(), TYPE_TERMINATION);
    }

    /**
     * Proposes to burn all base tokens.
     * 
     * This can be useful if the issuer wants to reissue the underlying securities in a
     * different form or on a different blockchain.
     */
    function proposeCancellation() external returns (Migration memory) {
        return _propose(baseToken(), TYPE_TERMINATION);
    }

    /**
     * Propose internal migration.
     * 
     * Internal migrations do not terminate the contract. It remains bindings.
     */
    function proposeInternalMigration() external returns (Migration memory) {
        return _propose(IMigratableBase(address(baseToken())).successor(), TYPE_INTERNAL);
    }

    /**
     * The issuer or holders with 10% of the tokens can cancal a proposed migration.
     */
    function cancelMigration() public {
        if (migration.migrationType == 0) revert MigrationNotFound(); 
        if (!canCancelMigration(msg.sender)) revert MigrationNoVetoPower();
        emit MigrationCancelled(msg.sender);
        delete migration;
    }
    
    /**
     * Returns whether the given address can cancel the current offer.
     */
    function canCancelMigration(address holder) public view returns (bool) {
        return holder == owner || (balanceOf(holder) > totalSupply() / 10);
    }
    
    /**
     * Anyone can execute the migration once it has passed the veto process.
     */
    function executeMigration() public {
        if (block.timestamp < migration.timestamp + MIGRATION_PROPOSAL_DELAY) revert MigrationTooEearly(migration.timestamp + MIGRATION_PROPOSAL_DELAY, block.timestamp); 
        if (migration.migrationType == TYPE_DEFAULT){
            // This is a normal migration, move all base tokens to the successor contract
            baseToken().transfer(address(migration.successor), baseToken().balanceOf(address(this)));
            replaceBase(migration.successor);
            terminate();
        } else if (migration.migrationType == TYPE_TERMINATION){
            // This is a termination, not a migration. Don't move any tokens.
            terminate();
        } else if (migration.migrationType == TYPE_INTERNAL){
            // This is an internal update of the base token
            (IMigratableBase(address(baseToken()))).migrate(); // obtain the new base token
        } else if (migration.migrationType == TYPE_CANCELLATION) {
            IMigratableBase(address(baseToken())).burn(baseToken().balanceOf(address(this)));
            replaceBase(migration.successor);
            terminate();
        } else {
            revert MigrationNotFound();
        }
        emit MigrationExecuted(msg.sender, migration.successor, migration.migrationType);
        delete migration;
    }

    function baseToken() internal virtual returns (IERC20);

    function replaceBase(IERC20 wrapped) internal virtual;

    function terminate() internal virtual;

}

interface IMigratableBase {
    function successor() external returns (IERC20);
    function migrate() external;
    function burn(uint256 amount) external;
}