// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract IRecoverable {

    function claimPeriod() external view virtual returns (uint256);
    
    function notifyClaimMade(address target) external virtual;

    function notifyClaimDeleted(address target) external virtual;

    function getCollateralRate(address collateral) public view virtual returns(uint256);

    function recover(address oldAddress, address newAddress) external virtual;

}