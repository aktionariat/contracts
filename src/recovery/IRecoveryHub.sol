// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract IRecoveryHub {

    function setRecoverable(bool flag) external virtual;
    
    function deleteClaim(address target) external virtual;

    function clearClaimFromToken(address holder) external virtual;

}