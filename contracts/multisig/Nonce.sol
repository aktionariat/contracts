// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

contract Nonce {

    uint256 public constant MAX_INCREASE = 100;
    uint128 private constant MASK = 1 << 127;
    uint128 private constant UNMASK = MASK ^ type(uint128).max;
    
    uint128 private max; // highest nonce ever used
    uint128 private reg;

    /// The nonce has been used before or lies outside the accepted window around the highest nonce.
    /// @param nonce The rejected nonce.
    error Nonce_AlreadyUsed(uint128 nonce);
    
    /**
     * The next recommended nonce, which is the highest nonce ever used plus one.
     * 
     * Starts with 1^127 to prevent replay attacks, i.e. multisig transactions being replayed on individual signer accounts.
     */
    function nextNonce() external view returns (uint128){
        return (max + 1) | MASK;
    }

    /**
     * Returns whether the provided nonce can be used.
     * For the 100 nonces in the interval [nextNonce(), nextNonce + 99], this is always true.
     * For the nonces in the interval [nextNonce() - 129, nextNonce() - 1], this is true for the nonces that have not been used yet.
     */ 
    function isFree(uint128 nonce) external view returns (bool){
        uint128 unmaskedNonce = UNMASK & nonce;
        return isValidHighNonce(unmaskedNonce) || isValidLowNonce(unmaskedNonce);
    }

    /**
     * Flags the given nonce as used.
     * Reverts if the provided nonce is not free.
     */
    function flagUsed(uint128 nonce) internal {
        uint128 unmaskedNonce = UNMASK & nonce;
        if (isValidHighNonce(unmaskedNonce)){
            reg = ((reg << 1) | 0x1) << (unmaskedNonce - max - 1);
            max = unmaskedNonce;
        } else if (isValidLowNonce(unmaskedNonce)){
            reg = uint128(reg | 0x1 << (max - unmaskedNonce - 1));
        } else {
            revert Nonce_AlreadyUsed(nonce);
        }
    }
    
    function setBoth(uint128 max_, uint128 reg_) private {
        max = max_;
        reg = reg_;
    }

    function isValidHighNonce(uint128 nonce) private view returns (bool){
        return nonce > max && nonce <= max + MAX_INCREASE;
    }

    function isValidLowNonce(uint128 nonce) private view returns (bool){
        if (nonce < max){
            uint256 diff = max - nonce;
            return diff <= 128 && ((0x1 << (diff - 1)) & reg == 0);
        } else {
            return false;
        }
    }
    
}