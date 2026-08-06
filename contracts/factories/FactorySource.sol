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

import {Shares} from "../shares/base/Shares.sol";
// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SharesUnderAgreement, IERC20} from "../shares/sha/SharesUnderAgreement.sol";
import {Deployment} from "../utils/Deployment.sol";
// import {TokenPoolInitialization} from "../multichain/lib/TokenPoolInitialization.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/contracts/interfaces/ITokenAdminRegistry.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";
import {RegistryModuleOwnerCustom} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/RegistryModuleOwnerCustom.sol";

contract FactorySource is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event SourceSharesResolved(address indexed sourceToken, bool wasDeployed);
    event SourceSharesUnderAgreementResolved(address indexed sourceWrapper, bool wasDeployed);
    event SourceTokenPoolAktionariatResolved(address indexed sourceWrapper, bool wasDeployed);

    event SourceTokenPoolDeployed(address indexed pool);

    struct ChainlinkAddresses {
        address tokenAdminRegistry;
        address registryModuleOwner;
        // // needed for proxy token pool
        // address rmnProxy;
        // address router;
        // needed for CCIP factory token pool: Only if not applicable
        address tokenPoolFactory;
    }

    struct SharesDeploymentData {
        address candidate;
        // constructor
        string symbol;
        string name;
        string terms;
        address owner;
    }

    struct SharesUnderAgreementDeploymentData {
        address candidate;
        // constructor
        string terms;
    }

    struct SourceParams {
        SharesDeploymentData shares;
        SharesUnderAgreementDeploymentData sharesUnderAgreement;
        ChainlinkAddresses chainlink;
        // Token Pool Bytecode: Only if not applicable
        bytes lockReleaseTokenPoolBytecode;
        TokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
        bytes32 salt;
    }

    struct SourceDeployment {
        address shares;
        address sharesUnderAgreement;
        address lockReleaseTokenPool;
    }

    address public SHARES_IMPLEMENTATION;
    address public SHA_IMPLEMENTATION;
    address public TOKEN_POOL_AKT_IMPLEMENTATION;

    constructor(
        Deployment.DeploymentData memory sharesLogicContract,
        Deployment.DeploymentData memory shaLogicContract,
        // Deployment.DeploymentData memory tokenPoolAktLogicContract,
        bytes32 salt
    ) Ownable(msg.sender) {
        bool wasDeployed;
        address deploymentAddress;

        // Deploys Shares business logic
        (deploymentAddress, wasDeployed) = Deployment._resolveAddressOrDeploy(sharesLogicContract, salt);
        SHARES_IMPLEMENTATION = deploymentAddress;
        emit SourceSharesResolved(deploymentAddress, wasDeployed);

        // Deploys Shares Under Agreement business logic
        (deploymentAddress, wasDeployed) = Deployment._resolveAddressOrDeploy(shaLogicContract, salt);
        SHA_IMPLEMENTATION = deploymentAddress;
        emit SourceSharesUnderAgreementResolved(deploymentAddress, wasDeployed);

        // // Deploys Token Pool business logic: Only if applicable
        // (deploymentAddress, wasDeployed) = Deployment._resolveAddressOrDeploy(tokenPoolAktLogicContract, salt);
        // TOKEN_POOL_AKT_IMPLEMENTATION = deploymentAddress;
        // emit SourceTokenPoolAktionariatResolved(deploymentAddress, wasDeployed);
    }

    /**
     * Deploys, Shares, SHA and TokenPool contracts, then sets the CCIP infrastructure to enable bridging via CCT.
     * Concludes by giving complete ownership to rightfull address.
     *
     * For backward compatibility we accept also already deployed Shares and SHA to do the CCIP setup.
     * For those shares, owneship of shares should be given to the factory before calling this function.
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
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // // Token Deployment
        if (params.sharesUnderAgreement.candidate != address(0)) {
            // SHA is deployed, so we can infer shares
            // return type purposes only
            deployment.sharesUnderAgreement = params.sharesUnderAgreement.candidate;

            deployment.shares = address(SharesUnderAgreement(deployment.sharesUnderAgreement).base());
            if (deployment.shares == address(0)) revert InvalidAddress();

            emit SourceSharesResolved(deployment.shares, false);
            emit SourceSharesUnderAgreementResolved(deployment.sharesUnderAgreement, false);
        } else {
            bool wasDeployed;

            // SHA is not deployed, we try to deploy both
            // Deploy Shares via Proxy
            (deployment.shares, wasDeployed) = Deployment._resolveAddressOrDeploy(params.shares.candidate, SHARES_IMPLEMENTATION, params.salt);
            emit SourceSharesResolved(deployment.shares, wasDeployed);

            // initialize Shares if they were deployed
            if (wasDeployed) {
                Shares(deployment.shares).initialize(
                    params.shares.symbol,
                    params.shares.name,
                    params.shares.terms,
                    futureOwner // no need for deployer ownership
                );
            }

            // Deploy Proxy Shares Under Agreement
            deployment.sharesUnderAgreement = Clones.cloneDeterministic(SHA_IMPLEMENTATION, params.salt);

            SharesUnderAgreement(deployment.sharesUnderAgreement).initialize(IERC20(deployment.shares), params.sharesUnderAgreement.terms, IERC20Metadata(deployment.shares).decimals(), address(this));
            emit SourceSharesUnderAgreementResolved(deployment.sharesUnderAgreement, true);
        }

        // Ensure the deployer is the owner of SHA
        // Sahres' owner is not a problem
        address shaOwner = IOwnable(deployment.sharesUnderAgreement).owner();
        if (shaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(shaOwner, address(this));
        }

        // // // Proxy Pool Deployment
        // // Proxy also pool? Do it, but do not remove the current vanilla Chainlink initialization
        // // // Pool Proxy Deployment
        // // Deploys Token Pool Proxy: Only if applicable
        // deployment.lockReleaseTokenPool = TokenPoolInitialization._deployProxyTokenPool(
        //     TOKEN_POOL_AKT_IMPLEMENTATION,
        //     deployment.sharesUnderAgreement,
        //     IERC20Metadata(deployment.sharesUnderAgreement).decimals(),
        //     TokenPoolFactory.PoolType.LOCK_RELEASE,
        //     params.chainlink.rmnProxy,
        //     params.chainlink.router,
        //     params.salt
        // );
        // TokenPoolInitialization._applyChainUpdatesTokenPool(deployment.lockReleaseTokenPool, params.remoteTokenPools, address(this));
        // emit SourceTokenPoolDeployed(deployment.lockReleaseTokenPool);

        // // Factory Pool Deployment
        // LockRelease Pool Deployment through Chainlink Factory Deployment
        // address token,
        // uint8 localTokenDecimals,
        // RemoteTokenPoolInfo[] calldata remoteTokenPools,
        // bytes calldata tokenPoolInitCode,
        // bytes32 salt,
        // PoolType poolType
        deployment.lockReleaseTokenPool = TokenPoolFactory(params.chainlink.tokenPoolFactory).deployTokenPoolWithExistingToken(
            deployment.sharesUnderAgreement,
            IERC20Metadata(deployment.sharesUnderAgreement).decimals(),
            params.remoteTokenPools,
            params.lockReleaseTokenPoolBytecode,
            params.salt,
            TokenPoolFactory.PoolType.LOCK_RELEASE
        );
        emit SourceTokenPoolDeployed(deployment.lockReleaseTokenPool);
        // now factory owns the pool, and it is deployed
        // Ownership of TokenPool in is now pending for Factory in LockReleaseTokenPool

        // // Settings: not deployment aware, need only SHA and Token Pool addresses
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
        // use futureOwner

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
}
