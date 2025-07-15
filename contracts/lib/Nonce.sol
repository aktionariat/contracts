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

contract Nonce {

    uint256 public constant MAX_INCREASE = 100;
    uint128 private constant MASK = 1 << 127;
    uint128 private constant UNMASK = MASK ^ type(uint128).max;
    
    uint128 private max; // highest nonce ever used
    uint128 private reg;
    
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
            revert("used");
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