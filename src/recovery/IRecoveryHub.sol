// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract IRecoveryHub {

    function setRecoverable(bool flag) public virtual;
    
    function deleteClaim(address target) public virtual;

    function clearClaimFromToken(address holder) public virtual;

}