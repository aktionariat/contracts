// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

abstract contract IRecoverable {

    function claimPeriod() public view virtual returns (uint256);
    
    function notifyClaimMade(address target) public virtual;

    function notifyClaimDeleted(address target) public virtual;

    function getCollateralRate(address collateral) public view virtual returns(uint256);

    function recover(address oldAddress, address newAddress) public virtual;

}