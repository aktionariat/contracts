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

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

library Deployment {
    error MissingDeploymentData();

    struct DeploymentData {
        address candidate;
        bytes contractBytecode;
        bytes constructorArgumentsBytecode;
    }

    /**
     * Given a generic Logic address, if needed deploys the proxy contract, ultimately
     * returns the contract address
     *
     * @param candidate candidate address
     * @param implementation address that holds the implementation contract to be proxied
     * @param salt deployment salt
     * @return address the address of the deployed or known contract
     * @return bool if the contract has been actually deployed
     */
    function _resolveAddressOrDeploy(address candidate, address implementation, bytes32 salt) internal returns (address, bool) {
        if (candidate != address(0)) {
            return (candidate, false);
        }

        if (implementation == address(0)) revert MissingDeploymentData();
        address proxyDeployed = Clones.cloneDeterministic(implementation, salt);
        return (proxyDeployed, true);
    }
}
