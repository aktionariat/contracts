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
import "../utils/Ownable.sol";

pragma solidity >=0.8.0 <0.9.0;

// abstract because it does not initiate Ownable
abstract contract DeterrenceFee is Ownable {

    uint96 public deterrenceFee;

    event DeterrenceFeePaid(address payer, uint96 fee);

    constructor(uint96 deterrenceFee_){
        deterrenceFee = deterrenceFee_;
    }

    modifier deter() {
        // Pay the deterrence fee to the Aktionariat ledger
        if (msg.sender != owner){
            payable(0x29Fe8914e76da5cE2d90De98a64d0055f199d06D).call{value:deterrenceFee}("");
            emit DeterrenceFeePaid(msg.sender, deterrenceFee);
        }
        _;
    }

    function setDeterrenceFee(uint96 fee) external onlyOwner {
        deterrenceFee = fee;
    }

}