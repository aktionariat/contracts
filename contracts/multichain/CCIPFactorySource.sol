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

import {Deployment} from "./library/deployment.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SharesUnderAgreement} from "../shares/sha/SharesUnderAgreement.sol";

// Again, this had to be saved from on-chain as library does not provide the exact
// on-chain interface
import {ITokenPoolFactory} from "../vendor/@chainlink/contracts-ccip/ITokenPoolFactory.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/contracts/interfaces/ITokenAdminRegistry.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";
import {RegistryModuleOwnerCustom} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/RegistryModuleOwnerCustom.sol";

contract CCIPFactorySource is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event SourceSharesTokenResolved(address indexed sourceToken, bool wasDeployed);
    event SourceSharesUnderAgreementResolved(address indexed sourceWrapper, bool wasDeployed);
    event SourceTokenPoolDeployed(address indexed pool);

    struct ChainlinkAddresses {
        address tokenAdminRegistry;
        address registryModuleOwner;
        address tokenPoolFactory;
    }

    struct SharesUnderAgreementDeploymentData {
        address candidate;
        bytes contractBytecode;
        // tbh the only thing that can change
        // from shares in the constructor is
        // terms, so we pass it in and collect
        // from shares the rest
        string terms;
    }

    struct SourceParams {
        Deployment.DeploymentData shares;
        SharesUnderAgreementDeploymentData sharesUnderAgreement;
        ChainlinkAddresses chainlink;
        bytes lockReleaseTokenPoolBytecode;
        // Prediction of addresses is left either to backend
        // or to chainlink token pool factory
        ITokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
        bytes32 salt;
    }

    struct SourceDeployment {
        address shares;
        address sharesUnderAgreement;
        address lockReleaseTokenPool;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * Deploys, Shares and SHA contracts and sets the CCIP infrastructure to enable bridging via CCT.
     * For backward compatibility we accept also already deployed SHA.
     *
     * @notice onlyOwner is not strictly necessary.
     * @dev You need sure that the true owner has the ability to accept ownership of TokenPool and the
     *      Token on the TokenAdminRegistry after the call.
     *      If SHA contract is passed by candidate, make sure that the owner of it is the factory pool,
     *      otherwise registerAdminViaOwner will fail
     * @param params deployment parameters.
     * @return deployment deployed addresses struct, comprehends Shares, SHA and LockReleaseTokenPool addresses.
     */
    function deploy(SourceParams calldata params, address futureOwner) external onlyOwner returns (SourceDeployment memory deployment) {
        // // Token Deployment
        if (params.sharesUnderAgreement.candidate != address(0)) {
            // SHA is deployed, so we can infer shares
            // return type purposes only
            deployment.sharesUnderAgreement = params.sharesUnderAgreement.candidate;

            deployment.shares = address(SharesUnderAgreement(deployment.sharesUnderAgreement).base());
            if (deployment.shares == address(0)) revert InvalidAddress();

            emit SourceSharesTokenResolved(deployment.shares, false);
            emit SourceSharesUnderAgreementResolved(deployment.sharesUnderAgreement, false);
        } else {
            bool wasDeployed;

            // SHA is not deployed, we try to deploy both
            // Shares
            (deployment.shares, wasDeployed) = Deployment._resolveAddressOrDeploy(params.shares, params.salt);
            if (deployment.shares == address(0)) revert InvalidAddress();
            emit SourceSharesTokenResolved(deployment.shares, wasDeployed);

            // Shares Under Agreement
            Deployment.DeploymentData memory shaDeploymentData = Deployment.DeploymentData({
                candidate: address(0),
                contractBytecode: params.sharesUnderAgreement.contractBytecode,
                constructorArgumentsBytecode: abi.encode(
                    deployment.shares,
                    // prbably they also remain the same
                    params.sharesUnderAgreement.terms,
                    // must have same decimals
                    IERC20Metadata(deployment.shares).decimals(),
                    // same owner
                    address(this)
                )
            });
            (deployment.sharesUnderAgreement, wasDeployed) = Deployment._resolveAddressOrDeploy(shaDeploymentData, params.salt);
            if (deployment.sharesUnderAgreement == address(0)) revert InvalidAddress();
            emit SourceSharesUnderAgreementResolved(deployment.sharesUnderAgreement, wasDeployed);
        }

        // Ensure the deployer is the owner
        // Sahres' owner is not a problem
        address bshaOwner = IOwnable(deployment.sharesUnderAgreement).owner();
        if (bshaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(bshaOwner, address(this));
        }

        // // Pool Deployment
        // Note that salt will be computed as:
        // salt = keccak256(abi.encodePacked(salt, msg.sender));
        // Within factory

        // Remote token pool HAS to be predicted
        // Also token decimals have to be 0 also for bridged tokens
        // remote token address must is to be predicted too

        // LockRelease Pool Deployment through Chainlink Factory Deployment
        // address token,
        // uint8 localTokenDecimals,
        // RemoteTokenPoolInfo[] calldata remoteTokenPools,
        // bytes calldata tokenPoolInitCode,
        // bytes32 salt,
        // PoolType poolType
        deployment.lockReleaseTokenPool = ITokenPoolFactory(params.chainlink.tokenPoolFactory).deployTokenPoolWithExistingToken(
            deployment.sharesUnderAgreement,
            IERC20Metadata(deployment.sharesUnderAgreement).decimals(),
            params.remoteTokenPools,
            params.lockReleaseTokenPoolBytecode,
            params.salt,
            ITokenPoolFactory.PoolType.LOCK_RELEASE
        );
        emit SourceTokenPoolDeployed(deployment.lockReleaseTokenPool);
        // now factory owns the pool, and it is deployed
        // Ownership of TokenPool in is now pending for Factory in LockReleaseTokenPool

        // // Settings
        // Ownership of TokenPool in TokenPool is pending: Accept ownership for Factory of TokenPool
        IOwnable(deployment.lockReleaseTokenPool).acceptOwnership();

        // Uses IOwner(token).owner() to set owner in the registry module
        // and checks that msg.sender is the token owner, that is only after accepting ownership
        // the user can call the function
        RegistryModuleOwnerCustom(params.chainlink.registryModuleOwner).registerAdminViaOwner(deployment.sharesUnderAgreement);
        // Ownership of Token in is now pending for Factory in TokenAdminRegistry

        // Accept admin role
        // Ownership of Token in TokenAdminRegistry is pending: Accept ownership for Factory of TokenPool
        ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).acceptAdminRole(deployment.sharesUnderAgreement);

        // Set pool, factory needs to be admin to do so
        // Setting of pool only viable by non-pending owner
        ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).setPool(deployment.sharesUnderAgreement, deployment.lockReleaseTokenPool);

        // Move admin to deployer for all contracts
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // Transfer ownership of TokenPool in TokenPool to deployer (or address)
        IOwnable(deployment.lockReleaseTokenPool).transferOwnership(futureOwner);
        // Then deployer will have to accept it through call:
        // IOwnable(deployment.lockReleaseTokenPool).acceptOwnership();

        // Transfer ownership of Token in TokenAdminRegistry to deployer (or address)
        ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).transferAdminRole(deployment.sharesUnderAgreement, futureOwner);
        // Then deployer will have to accept Administration through call:
        // ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).acceptAdminRole(deployment.sharesUnderAgreement);

        // // Shares and SHA ownership is not handled by their constructor, but set as
        // // factory during deployment because of CCIP flow
        // transfer Shares and SHA ownership to deployer (or address)
        // IOwnable(deployment.shares).transferOwnership(futureOwner);
        IOwnable(deployment.sharesUnderAgreement).transferOwnership(futureOwner);
        // no need to accept ownership here
        return deployment;
    }

    // TODO: add function to add a destination pool and to manage a pool?
}
