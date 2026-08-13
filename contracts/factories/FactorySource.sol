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
import {SharesUnderAgreement, IERC20} from "../shares/sha/SharesUnderAgreement.sol";

import {Deployment} from "../utils/Deployment.sol";

import {TokenPoolService} from "./lib/TokenPoolService.sol";
import {CCIPService} from "./lib/CCIPService.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";

/**
 * FactorySource contract, to manage deployment and automatic CCIP integration.
 *
 * To halt and acivate the bridge you must directly call the token pool via
 * functions: `haltChains` and `activateChains`
 */
contract FactorySource is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error NotPoolOwner(address sender);
    error InvalidAddress();

    event SharesLogicResolved(address indexed sourceToken);
    event SharesUnderAgreementLogicResolved(address indexed sourceWrapper);
    event TokenPoolLogicResolved(address indexed sourcePool);

    event SharesDeployed(address indexed proxyToken, string symbol);
    event SharesUnderAgreementDeployed(address indexed proxyWrapper, string symbol);
    event TokenPoolDeployed(address indexed proxyPool);

    struct ChainlinkAddresses {
        address tokenAdminRegistry;
        address registryModuleOwner;
        // needed for proxy token pool
        address rmnProxy;
        address router;
    }

    struct SharesDeploymentData {
        address candidate;
        // constructor
        string symbol;
        string name;
        string terms;
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
        TokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
    }

    struct SourceDeployment {
        address shares;
        address sharesUnderAgreement;
        address lockReleaseTokenPool;
    }

    address public SHARES_IMPLEMENTATION;
    address public SHA_IMPLEMENTATION;
    address public TOKEN_POOL_IMPLEMENTATION;

    /**
     * Factory Constructor.
     * Sets the BSHA logic contract address.
     *
     * @dev We initialize at constructor since the code is initialization-dependent, that is
     *      if we change the BSHA contract initialization call we would need to chnage the code
     *      also in the factory
     *
     * @param sharesLogicContract the Shares logic contract address
     * @param shaLogicContract the SHA logic contract address
     * @param tokenPoolLogicContract the TokenPool logic contract address
     */
    constructor(address sharesLogicContract, address shaLogicContract, address tokenPoolLogicContract) Ownable(msg.sender) {
        // Shares
        SHARES_IMPLEMENTATION = sharesLogicContract;
        emit SharesLogicResolved(sharesLogicContract);

        // SHA
        SHA_IMPLEMENTATION = shaLogicContract;
        emit SharesUnderAgreementLogicResolved(shaLogicContract);

        // TokenPool
        TOKEN_POOL_IMPLEMENTATION = tokenPoolLogicContract;
        emit TokenPoolLogicResolved(tokenPoolLogicContract);
    }

    /**
     * Deploys, Shares, SHA and TokenPool contracts, then sets the CCIP infrastructure to enable bridging via CCT.
     * Concludes by giving complete ownership to rightfull address.
     *
     * For backward compatibility we accept also already deployed Shares and SHA to do the CCIP setup.
     * For those shares, owneship of shares should be given to the factory before calling this function.
     *
     * @notice onlyOwner is not strictly necessary.
     * @dev You need to make sure that the true owner has the ability to accept ownership of TokenPool and the
     *      Token on the TokenAdminRegistry after the call. If SHA contract is passed by candidate, make sure
     *      that the owner of it is the factory pool, otherwise registerAdminViaOwner will fail
     * @dev If
     * @param params deployment parameters.
     * @return deployment deployed addresses struct, comprehends Shares, SHA and LockReleaseTokenPool addresses.
     */
    function deploy(SourceParams calldata params, address futureOwner, bytes32 salt) external onlyOwner returns (SourceDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // // Token Deployment
        if (params.sharesUnderAgreement.candidate != address(0)) {
            // SHA is deployed, so we can infer shares
            // we give the possibility to initialize standalone deployments

            // return type purposes only
            deployment.sharesUnderAgreement = params.sharesUnderAgreement.candidate;

            deployment.shares = address(SharesUnderAgreement(deployment.sharesUnderAgreement).base());
            if (deployment.shares == address(0)) revert InvalidAddress();

            emit SharesDeployed(deployment.shares, IERC20Metadata(deployment.shares).symbol());
            emit SharesUnderAgreementDeployed(deployment.sharesUnderAgreement, IERC20Metadata(deployment.sharesUnderAgreement).symbol());
        } else {
            bool wasDeployed;

            // SHA is not deployed, we try to deploy both, we leave possibility
            // to "deploy" (initialize) already deployed tokens
            // Infer or Deploy Shares via Proxy
            (deployment.shares, wasDeployed) = Deployment._resolveAddressOrDeploy(params.shares.candidate, SHARES_IMPLEMENTATION, salt);
            // initialize Shares if it was deployed
            if (wasDeployed) {
                Shares(deployment.shares).initialize(
                    params.shares.symbol,
                    params.shares.name,
                    params.shares.terms,
                    futureOwner // no need for deployer ownership
                );
            }
            emit SharesDeployed(deployment.shares, params.shares.symbol);

            // Deploy Proxy Shares Under Agreement
            deployment.sharesUnderAgreement = Clones.cloneDeterministic(SHA_IMPLEMENTATION, salt);

            SharesUnderAgreement(deployment.sharesUnderAgreement).initialize(IERC20(deployment.shares), params.sharesUnderAgreement.terms, IERC20Metadata(deployment.shares).decimals(), address(this));
            emit SharesUnderAgreementDeployed(deployment.sharesUnderAgreement, IERC20Metadata(deployment.sharesUnderAgreement).symbol());
        }

        // Ensure the deployer is the owner of SHA
        // Sahres' owner is not a problem
        address shaOwner = IOwnable(deployment.sharesUnderAgreement).owner();
        if (shaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(shaOwner, address(this));
        }

        // // Proxy Pool Deployment
        // Proxy also pool? Do it, but do not remove the current vanilla Chainlink initialization
        // // Pool Proxy Deployment
        // Deploys Token Pool Proxy: Only if applicable
        deployment.lockReleaseTokenPool = TokenPoolService._deployProxyTokenPool(
            TOKEN_POOL_IMPLEMENTATION,
            deployment.sharesUnderAgreement,
            IERC20Metadata(deployment.sharesUnderAgreement).decimals(),
            TokenPoolFactory.PoolType.LOCK_RELEASE,
            params.chainlink.rmnProxy,
            params.chainlink.router,
            salt
        );
        TokenPoolService._applyChainUpdatesTokenPool(deployment.lockReleaseTokenPool, params.remoteTokenPools, salt);
        emit TokenPoolDeployed(deployment.lockReleaseTokenPool);

        // // // Further Pool settings do require only SHA and Pool addresses
        CCIPService._applySettingToChainlinkCCIPInfrastructure(
            deployment.lockReleaseTokenPool,
            deployment.sharesUnderAgreement,
            futureOwner,
            params.chainlink.registryModuleOwner,
            params.chainlink.tokenAdminRegistry
        );

        // // Shares and SHA ownership is not handled by their constructor, but set as
        // // factory during deployment because of CCIP flow
        // transfer Shares and SHA ownership to deployer (or address)
        // IOwnable(deployment.shares).transferOwnership(futureOwner);
        IOwnable(deployment.sharesUnderAgreement).transferOwnership(futureOwner);
        // no need to accept ownership here
        return deployment;
    }
}
