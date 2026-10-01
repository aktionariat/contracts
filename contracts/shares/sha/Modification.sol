// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

/**
 * @title Modification
 * @author Luzius Meisser, luzius@aktionariat.com
 * @author Murat Ögat, murat@aktionariat.com
 *
 * Changes what the SharesUnderAgreement wrap, after a 20 day delay in which the contract owner or any
 * holder of more than 10% of the wrapped tokens can cancel.
 * - Migration: the base tokens move into a successor contract and the agreement ends. Holders unwrap
 *   to the successor token by themselves.
 * - Internal migration: the base token is replaced by its own successor, the agreement stays binding.
 * - Termination: the agreement ends, holders unwrap to the base token.
 * - Cancellation: the base tokens are burned and the agreement ends, for a reissuance in another form.
 */

import "./Wrapping.sol";

abstract contract Modification is Wrapping {

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

    error NotQualified();
    error MigrationNotFound();
    error MigrationTooEarly(uint256 earliest, uint256 timenow);

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
        if (!isQualified(msg.sender)) revert NotQualified();
        migration = Migration({ successor: successor, timestamp: uint64(block.timestamp), migrationType: migrationType });
        emit MigrationProposed(msg.sender, successor, migrationType);
        return migration;
	}

    /**
     * Propose a termination of the shareholder agreement.
     */
    function proposeTermination() external returns (Migration memory) {
        // When terminating, the new base is the old base
        return _propose(base, TYPE_TERMINATION);
    }

    /**
     * Proposes to burn all base tokens.
     * 
     * This can be useful if the issuer wants to reissue the underlying securities in a
     * different form or on a different blockchain.
     */
    function proposeCancellation() external onlyOwner returns (Migration memory) {
        return _propose(base, TYPE_CANCELLATION);
    }

    /**
     * Propose internal migration.
     * 
     * Internal migrations do not terminate the contract. It remains binding.
     */
    function proposeInternalMigration() external onlyOwner returns (Migration memory) {
        return _propose(IMigratableBase(address(base)).successor(), TYPE_INTERNAL);
    }

    /**
     * The issuer or holders with 10% of the tokens can cancel a proposed migration.
     */
    function cancelMigration() public {
        if (migration.timestamp == 0) revert MigrationNotFound(); 
        if (!isQualified(msg.sender)) revert NotQualified();
        emit MigrationCancelled(msg.sender);
        delete migration;
    }
    
    /**
     * Returns whether the given address can initiate or cancel a migration: the issuer or a holder of
     * more than 10% of the wrapped tokens. Everyone else objects through the issuer.
     */
    function isQualified(address holder) public view returns (bool) {
        return holder == owner || (balanceOf(holder) > totalSupply() / 10);
    }
    
    /**
     * Anyone can execute the migration once it has passed the veto process.
     */
    function executeMigration() public {
        Migration memory mig = prepareExecution(); // reverts if migration not found or too early
        if (mig.migrationType == TYPE_DEFAULT){
            // This is a normal migration, move all base tokens to the successor contract
            uint256 balance = base.balanceOf(address(this));
            base.approve(address(mig.successor), balance);
            ISuccessor(address(mig.successor)).wrap(balance); // sends all base tokens to the successor and we get successor tokens in return
            replaceBase(mig.successor);
            terminate();
        } else if (mig.migrationType == TYPE_TERMINATION){
            // This is a termination, not a migration. Don't move any tokens.
            terminate();
        } else if (mig.migrationType == TYPE_INTERNAL){
            // This is an internal update of the base token
            IMigratableBase migratable = IMigratableBase(address(base));
            if (address(migratable.successor()) != address(mig.successor)) revert MigrationNotFound(); // make sure the proposed successor is the actual successor of the base token
            migratable.migrate(); // tells the old base to migrate to the new base
            replaceBase(mig.successor); // replace the base with the new base
        } else if (mig.migrationType == TYPE_CANCELLATION) {
            IMigratableBase(address(base)).burn(base.balanceOf(address(this)));
            terminate();
        }
        emit MigrationExecuted(msg.sender, mig.successor, mig.migrationType);
    }

    function prepareExecution() internal returns (Migration memory) {
        Migration memory mig = migration;
        if (mig.timestamp == 0) revert MigrationNotFound();
        if (block.timestamp < mig.timestamp + MIGRATION_PROPOSAL_DELAY) revert MigrationTooEarly(mig.timestamp + MIGRATION_PROPOSAL_DELAY, block.timestamp); 
        delete migration;
        return mig;
    }

}

interface IMigratableBase {
    function successor() external returns (IERC20);
    function migrate() external;
    function burn(uint256 amount) external;
}

interface ISuccessor {
    function wrap(uint256 amount) external;
}