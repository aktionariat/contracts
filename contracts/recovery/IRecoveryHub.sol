// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./IRecoverable.sol";
import "../ERC20/IERC20.sol";

interface IRecoveryHub {

	/*//////////////////////////////////////////////////////////////
                            Custom errors
    //////////////////////////////////////////////////////////////*/
    /// Recovery can be disabled per address.
    /// @param lostAddress The address for which the recovery is disabled.
    error RecoveryHub_RecoveryDisabled(address lostAddress);
    /// No valid collateral type
    /// @param collateralType The address of collateral type token
    error RecoveryHub_BadCollateral(IERC20 collateralType);
    /// No token to able to recover on the lost address
    /// @param token The token address which is checked for recovery.
    /// @param lostAddress The lost address.
    error RecoveryHub_NothingToRecover(IERC20 token, address lostAddress);
    /// The was already a claim for this token and address.
    /// @param token The token address.
    /// @param lostAddress The lost address.
    error RecoveryHub_AlreadyClaimed(IERC20 token, address lostAddress);
    /// Sender has to be claimant
    /// @param sender The msg.sender of the call
    error RecoveryHub_InvalidSender(address sender);
    /// No claim for this address exists
    /// @param lostAddress The checked address 
    error RecoveryHub_ClaimNotFound(address lostAddress);
    /// Recover can only be called after the claim period
    /// @param claimPeriodEnd The timestamp when the period ends
    /// @param currentTimestamp The block timestamp of the call
    error RecoveryHub_InClaimPeriod(uint256 claimPeriodEnd, uint256 currentTimestamp);

    function setRecoverable(bool flag) external;
    
    // deletes claim and transfers collateral back to claimer
    function deleteClaim(address target) external;

    // clears claim and transfers collateral to holder
    function clearClaimFromToken(address holder) external;

    function clearClaimFromUser(IRecoverable token) external;

}