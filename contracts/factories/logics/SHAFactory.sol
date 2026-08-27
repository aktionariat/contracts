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

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {Deployment} from "../lib/Deployment.sol";

contract SHAFactory is Ownable {
    bytes public bytecode;
    bytes32 public bytecodeHash;

    event BytecodeUpdated(bytes32 indexed newHash);
    event TokenDeployed(address indexed deployed, string symbol);
    error EmptyBytecode();

    constructor(bytes memory initialBytecode) Ownable(msg.sender) {
        if (initialBytecode.length == 0) revert EmptyBytecode();
        bytecode = initialBytecode;
        bytecodeHash = keccak256(initialBytecode);
    }

    function setBytecode(bytes calldata newBytecode) external onlyOwner {
        if (newBytecode.length == 0) revert EmptyBytecode();
        bytecode = newBytecode;
        bytecodeHash = keccak256(newBytecode);
        emit BytecodeUpdated(bytecodeHash);
    }

    /**
     * @notice Predict the CREATE2 address of a SharesUnderAgreement deployment from this factory.
     */
    function predict(
        bytes32 salt,
        address baseToken,
        string calldata terms,
        uint8 decimals,
        address owner
    ) external view returns (address) {
        // base token may not be deployed
        return Deployment.compute(bytecode, address(this), salt, abi.encode(baseToken, terms, decimals, owner));
    }

    /**
     * @notice Deploy a SharesUnderAgreement token via CREATE2 from this factory.
     */
    function deploy(
        bytes32 salt,
        address baseToken,
        string calldata terms,
        uint8 decimals,
        address owner
    ) external returns (address deployed) {
        bytes memory initCode = abi.encodePacked(
            bytecode,
            abi.encode(baseToken, terms, decimals, owner)
        );
        deployed = Create2.deploy(0, salt, initCode);

        // after deployment symbol changes
        string memory symbol = IERC20Metadata(deployed).symbol();
        emit TokenDeployed(deployed, symbol);
    }
}
