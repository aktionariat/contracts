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

import {Shares} from "../shares/base/Shares.sol";
import {SharesUnderAgreement, IERC20} from "../shares/sha/SharesUnderAgreement.sol";

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

    event SharesDeployed(address indexed proxyToken, string symbol);
    event SharesUnderAgreementDeployed(address indexed proxyWrapper, string symbol);
    event TokenPoolDeployed(address indexed proxyPool);

    struct ChainlinkAddresses {
        address tokenPoolFactory;
        address tokenAdminRegistry;
        address registryModuleOwner;
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
        bytes lockReleaseTokenPoolBytecode;
        TokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
    }

    struct TokenDeployment {
        address shares;
        address sharesUnderAgreement;
    }

    struct TokenPoolDeployment {
        address lockReleaseTokenPool;
    }

    struct SourceDeployment {
        TokenDeployment token;
        TokenPoolDeployment tokenPool;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * Deploys Shares, SHA and TokenPool contracts, then sets the CCIP infrastructure to enable bridging via CCT.
     *
     * For backward compatibility we accept also already deployed Shares and SHA to do the deployment setup.
     * For those shares, owneship of SHA should be given to the factory before calling this function.
     *
     * @notice see deployToken and deployTokenBridge requirements
     */
    function deploy(SourceParams calldata params, address futureOwner, bytes32 salt) external onlyOwner returns (SourceDeployment memory deployment) {
        // // Token Deployment
        if (params.sharesUnderAgreement.candidate != address(0)) {
            // SHA is deployed, so we can infer shares
            // we give the possibility to deploy standalone deployments

            // return type purposes only
            deployment.token.sharesUnderAgreement = params.sharesUnderAgreement.candidate;

            deployment.token.shares = address(SharesUnderAgreement(deployment.token.sharesUnderAgreement).base());
            if (deployment.token.shares == address(0)) revert InvalidAddress();
            // owner check deferred to deployTokenBridge
        } else {
            // call deployment
            TokenDeployment memory tokenDeployment = deployTokens(
                params.shares, params.sharesUnderAgreement, address(this), salt
            );

            if (IOwnable(tokenDeployment.shares).owner() == address(this)) {
                IOwnable(tokenDeployment.shares).transferOwnership(futureOwner);
            }

            deployment.token = tokenDeployment;
        }

        // // Token Pool Deployment
        deployment.tokenPool = deployTokenBridge(
            deployment.token.sharesUnderAgreement,
            params.chainlink,
            params.lockReleaseTokenPoolBytecode,
            params.remoteTokenPools,
            futureOwner,
            salt
        );

        return deployment;
    }

    /**
     * Deploys shares token infrastructure.
     * First deploys Shares, then SharesUnderAgreement
     */
    function deployTokens(SharesDeploymentData calldata shares, SharesUnderAgreementDeploymentData calldata sha,  address futureOwner, bytes32 salt) public onlyOwner returns(TokenDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // SHA is not deployed, we try to deploy both, we leave possibility
        // to "deploy" (initialize) already deployed share tokens
        // Infer or Deploy Shares via Contract
        if (shares.candidate != address(0)) {
            deployment.shares = shares.candidate;
        } else {
            deployment.shares  = address(
                new Shares{salt: salt}(
                    shares.symbol,
                    shares.name,
                    shares.terms,
                    futureOwner // no need for deployer ownership
                )
            );
        }
        emit SharesDeployed(deployment.shares, shares.symbol);

        // Deploy Shares Under Agreement
        deployment.sharesUnderAgreement  = address(
            new SharesUnderAgreement{salt: salt}(
                IERC20(deployment.shares),
                sha.terms,
                IERC20Metadata(deployment.shares).decimals(),
                futureOwner
            )
        );
        emit SharesUnderAgreementDeployed(deployment.sharesUnderAgreement, IERC20Metadata(deployment.sharesUnderAgreement).symbol());
    }

    /**
     * Deploys the token pool and sets up the CCIP Bridge infrastructure
     */
    function deployTokenBridge(
        address sharesUnderAgreement,
        ChainlinkAddresses calldata chainlink,
        bytes calldata lockReleaseTokenPoolBytecode,
        TokenPoolFactory.RemoteTokenPoolInfo[] calldata remoteTokenPools,
        address futureOwner,
        bytes32 salt
    ) public onlyOwner returns(TokenPoolDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // Ensure the factory is the owner of SHA, Shares' owner is not a problem
        address shaOwner = IOwnable(sharesUnderAgreement).owner();
        if (shaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(shaOwner, address(this));
        }

        // // Chainlink Factory Token Pool Deployment
        // LockRelease Pool Deployment through Chainlink Factory Deployment
        // address token,
        // uint8 localTokenDecimals,
        // RemoteTokenPoolInfo[] calldata remoteTokenPools,
        // bytes calldata tokenPoolInitCode,
        // bytes32 salt,
        // PoolType poolType
        deployment.lockReleaseTokenPool = TokenPoolFactory(chainlink.tokenPoolFactory).deployTokenPoolWithExistingToken(
            sharesUnderAgreement,
            IERC20Metadata(sharesUnderAgreement).decimals(),
            remoteTokenPools,
            lockReleaseTokenPoolBytecode,
            salt,
            TokenPoolFactory.PoolType.LOCK_RELEASE
        );
        emit TokenPoolDeployed(deployment.lockReleaseTokenPool);

        // // Further Pool settings do require only SHA and Pool addresses
        CCIPService._applySettingToChainlinkCCIPInfrastructure(
            deployment.lockReleaseTokenPool,
            sharesUnderAgreement,
            futureOwner,
            chainlink.registryModuleOwner,
            chainlink.tokenAdminRegistry
        );

        // transfer Shares and SHA ownership to futureOwner
        IOwnable(sharesUnderAgreement).transferOwnership(futureOwner);
    }
}
