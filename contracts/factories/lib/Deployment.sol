/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2025 Aktionariat AG (aktionariat.com)
 *
 * Permission is hereby granted, any person obtaining a copy of this software
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
pragma solidity ^0.8.26;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

library Deployment {
    error CallerMustBeContractOwner(address owner, address caller);

    function _isContractOwner(address ownableContract, address possibleOwner) internal view {
        address owner = Ownable(ownableContract).owner();
        if (owner != possibleOwner) revert CallerMustBeContractOwner(owner, possibleOwner);
    }

    /**
     * @notice Computes the CREATE2 address from stored bytecode and constructor arguments.
     * @param bytecode        The raw creation bytecode of the target contract.
     * @param deployer        The address that will execute Create2.deploy.
     * @param salt            The CREATE2 salt.
     * @param constructorArgs The abi-encoded constructor arguments.
     * @return                The predicted CREATE2 address.
     */
    function compute(
        bytes memory bytecode,
        address deployer,
        bytes32 salt,
        bytes memory constructorArgs
    ) internal pure returns (address) {
        return Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(bytecode, constructorArgs)),
            deployer
        );
    }
}
