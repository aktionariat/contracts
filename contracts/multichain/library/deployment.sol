/**
 * SPDX-License-Identifier: LicenseRef-Aktionariat
 *
 * MIT License with Automated License Fee Payments
 *
 * Copyright (c) 2025 Aktionariat AG (aktionariat.com)
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

import "@openzeppelin/contracts/utils/Create2.sol";

library Deployment {
    error MissingDeploymentData();
    error DeploymentFailed();

    struct DeploymentData {
        address candidate;
        bytes contractBytecode;
        bytes constructorArgumentsBytecode;
    }

    /**
     * Given a generic Deplyment data, if needed deploys the contract, ultimately
     * returns the contract address
     *
     * @param data deployment data
     * @param salt deployment salt
     * @return resolved the address of the deployed or known contract
     * @return wasDeployed if the contract has been actually deployed
     */
    function _resolveAddressOrDeploy(DeploymentData memory data, bytes32 salt) internal returns (address resolved, bool wasDeployed) {
        if (data.candidate != address(0)) {
            return (data.candidate, false);
        }

        if (data.contractBytecode.length == 0) revert MissingDeploymentData();

        bytes memory initCode = bytes.concat(data.contractBytecode, data.constructorArgumentsBytecode);
        address deployed = _create2(initCode, salt);
        return (deployed, true);
    }

    /**
     * Deploys a contract with the given salt and returns its address
     *
     * @param initCode the bytecode of the contract
     * @param salt the salt for the deployment
     */
    function _create2(bytes memory initCode, bytes32 salt) internal returns (address deployed) {
        deployed = Create2.deploy(0, salt, initCode);
        if (deployed == address(0)) revert DeploymentFailed();
    }
}
