// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20/IERC20.sol";
import "./IRecoveryHub.sol";

interface IRecoverable is IERC20{

	/*//////////////////////////////////////////////////////////////
                            Custom errors
    //////////////////////////////////////////////////////////////*/
    /// The new customm claim collateral rate has to be always > 0. 
    error Recoverable_RateZero();
    /// Failguard when an erc20 transfer returns false. 
    error Recoverable_TransferFailed();

    // returns the recovery hub
    function recovery() external view returns (IRecoveryHub);

    function claimPeriod() external view returns (uint256);
    
    function notifyClaimMade(address target) external;

    function notifyClaimDeleted(address target) external;

    function getCollateralRate(IERC20 collateral) external view returns(uint256);

    function recover(address oldAddress, address newAddress) external;

}