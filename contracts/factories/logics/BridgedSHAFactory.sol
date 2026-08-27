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

import {TokenFactory} from "../base/TokenFactory.sol";

/**
 * @title BridgedSHAFactory
 * @notice On-chain bytecode storage and CREATE2 deployer for the BridgedSharesUnderAgreement contract.
 */
contract BridgedSHAFactory is TokenFactory {
    constructor(bytes memory initialBytecode) TokenFactory(initialBytecode) {}

    /**
     * @notice Predict the CREATE2 address of a BridgedSharesUnderAgreement deployment from this factory.
     */
    function predict(
        bytes32 salt,
        string calldata symbol,
        string calldata name,
        string calldata terms,
        address owner
    ) external view returns (address) {
        return _predictAddress(salt, abi.encode(symbol, name, terms, owner));
    }

    /**
     * @notice Deploy a BridgedSharesUnderAgreement token via CREATE2 from this factory.
     */
    function deploy(
        bytes32 salt,
        string calldata symbol,
        string calldata name,
        string calldata terms,
        address owner
    ) external returns (address deployed) {
        deployed = _deployToken(salt, abi.encode(symbol, name, terms, owner), symbol);
    }
}
