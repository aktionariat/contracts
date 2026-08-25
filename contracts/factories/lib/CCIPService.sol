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
pragma solidity ^0.8.26;

import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/contracts/interfaces/ITokenAdminRegistry.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";
import {RegistryModuleOwnerCustom} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/RegistryModuleOwnerCustom.sol";

library CCIPService {
    function _applySettingToChainlinkCCIPInfrastructure(address tokenPool, address token, address futureOwner, address registryModuleOwner, address tokenAdminRegistry) internal {
        // Ownership of TokenPool in TokenPool is pending: We deployed the pool
        // through chainlink's factory
        IOwnable(tokenPool).acceptOwnership();

        // Uses IOwner(token).owner() to set owner in the registry module
        // and checks that msg.sender is the token owner, that is only after accepting ownership
        // the user can call the function
        RegistryModuleOwnerCustom(registryModuleOwner).registerAdminViaOwner(token);
        // Ownership of Token in is now pending for Factory in TokenAdminRegistry

        // Accept admin role
        // Ownership of Token in TokenAdminRegistry is pending: Accept ownership for Factory of TokenPool
        ITokenAdminRegistry(tokenAdminRegistry).acceptAdminRole(token);

        // Set pool, factory needs to be admin to do so
        // Setting of pool only viable by non-pending owner
        ITokenAdminRegistry(tokenAdminRegistry).setPool(token, tokenPool);

        // Move all contracts to futureOwner adimn

        // Transfer ownership of TokenPool in TokenPool to futureOwner
        IOwnable(tokenPool).transferOwnership(futureOwner);
        // Then futureOwner will have to accept it through call:
        // IOwnable(tokenPool).acceptOwnership();
        // directly to the tokenPool contract

        // Transfer ownership of Token in TokenAdminRegistry to futureOwner
        ITokenAdminRegistry(tokenAdminRegistry).transferAdminRole(token, futureOwner);
        // Then futureOwner will have to accept Administration through call:
        // ITokenAdminRegistry(tokenAdminRegistry).acceptAdminRole(token);
        // directly to Chainlink's tokenAdminRegistry contract
    }
}
