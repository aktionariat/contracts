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
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {SharesUnderAgreement} from "../shares/sha/SharesUnderAgreement.sol";

import {SharesFactory} from "./logics/SharesFactory.sol";
import {SHAFactory} from "./logics/SHAFactory.sol";
import {CCIPLockReleaseTokenPoolFactory} from "./logics/CCIPLockReleaseTokenPoolFactory.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";

contract TokenDeploymentManagerSource is Ownable {
    // if ever to be changed, interface contracts changed
    SharesFactory public immutable sharesFactory;
    SHAFactory public immutable shaFactory;
    CCIPLockReleaseTokenPoolFactory public immutable lockReleaseTokenPoolFactory;

    struct SharesDeploymentData {
        address candidate;
        // constructor arguments
        string symbol;
        string name;
        string terms;
    }

    struct SharesUnderAgreementDeploymentData {
        address candidate;
        // constructor argument
        string terms;
    }

    struct SourceParams {
        SharesDeploymentData shares;
        SharesUnderAgreementDeploymentData sharesUnderAgreement;
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

    event TokenDeploymentSource(TokenDeployment indexed deployment);
    event InfraDeploymentSource(SourceDeployment indexed deployment);

    error InvalidAddress();

    constructor(
        SharesFactory _sharesFactory,
        SHAFactory _shaFactory,
        CCIPLockReleaseTokenPoolFactory _lockReleaseTokenPoolFactory
    ) Ownable(msg.sender) {
        if (
            address(_sharesFactory) == address(0) || address(_shaFactory) == address(0) || address(_lockReleaseTokenPoolFactory) == address(0)
        ) {
            revert InvalidAddress();
        }
        sharesFactory = _sharesFactory;
        shaFactory = _shaFactory;
        lockReleaseTokenPoolFactory = _lockReleaseTokenPoolFactory;
    }

    /**
     * @notice Predicts every address that `deploy` would create for the given
     *         inputs, assuming all tokens are deployed fresh (candidates ignored).
     */
    function predict(SharesDeploymentData calldata sharesParams, SharesUnderAgreementDeploymentData calldata shaParams, address futureOwner, bytes32 salt) external view returns (SourceDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // Shares are deployed (and transiently owned) by this manager.
        deployment.token.shares = sharesFactory.predict(
            salt,
            sharesParams.symbol,
            sharesParams.name,
            sharesParams.terms,
            futureOwner
        );

        // decimals are always 0
        deployment.token.sharesUnderAgreement = shaFactory.predict(
            salt,
            deployment.token.shares,
            shaParams.terms,
            0,
            address(lockReleaseTokenPoolFactory)
        );

        // LockRelease pool, deployed by Chainlink's factory (through the pool logic).
        deployment.tokenPool.lockReleaseTokenPool = lockReleaseTokenPoolFactory.predict(
            salt,
            deployment.token.sharesUnderAgreement,
            0
        );
    }

    // // Deployment orchestration helpers

    /**
     * @notice Deploys the whole source-chain infrastructure: Shares,
     *         SharesUnderAgreement and the LockRelease Token Pool with its CCIP
     *         settings.
     *
     * For backward compatibility, already deployed Shares/SHA can be supplied
     * through their `candidate`. When a SHA candidate is given, the SHA must
     * already be owned by the lock-release pool logic factory (which will take
     * care of the pool and hand ownership over to `futureOwner`).
     */
    function deploy(SourceParams calldata params, address futureOwner, bytes32 salt) external onlyOwner returns (SourceDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // // Token Deployment
        if (params.sharesUnderAgreement.candidate != address(0)) {
            // use existing SHA and infer the shares from it
            deployment.token.sharesUnderAgreement = params.sharesUnderAgreement.candidate;
            deployment.token.shares = address(SharesUnderAgreement(deployment.token.sharesUnderAgreement).base());
            if (deployment.token.shares == address(0)) revert InvalidAddress();
        } else {
            // deploy Shares, transiently owned by this manager
            if (params.shares.candidate != address(0)) {
                deployment.token.shares = params.shares.candidate;
            } else {
                deployment.token.shares = sharesFactory.deploy(
                    salt,
                    params.shares.symbol,
                    params.shares.name,
                    params.shares.terms,
                    futureOwner
                );
            }

            // deploy SHA, owned by the pool logic factory so it can set up CCIP
            deployment.token.sharesUnderAgreement = shaFactory.deploy(
                salt,
                deployment.token.shares,
                params.sharesUnderAgreement.terms,
                IERC20Metadata(deployment.token.shares).decimals(),
                address(lockReleaseTokenPoolFactory)
            );
        }

        // // Token Pool Deployment
        // will give ownership of SHA to futureOwner
        deployment.tokenPool.lockReleaseTokenPool = lockReleaseTokenPoolFactory.deploy(
            salt,
            deployment.token.sharesUnderAgreement,
            params.remoteTokenPools,
            futureOwner
        );

        emit InfraDeploymentSource(deployment);
        return deployment;
    }

    /**
     * @notice Deploys the whole source-chain token infra: Shares,
     *         SharesUnderAgreement
     */
    function deploy(SharesDeploymentData calldata shares, SharesUnderAgreementDeploymentData calldata sha, address futureOwner, bytes32 salt) external onlyOwner returns (TokenDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // // Token Deployment
        // deploy Shares, transiently owned by this manager
        if (shares.candidate != address(0)) {
            deployment.shares = shares.candidate;
        } else {
            deployment.shares = sharesFactory.deploy(
                salt,
                shares.symbol,
                shares.name,
                shares.terms,
                futureOwner
            );
        }

        // deploy SHA, owned by the pool logic factory so it can set up CCIP
        deployment.sharesUnderAgreement = shaFactory.deploy(
            salt,
            deployment.shares,
            sha.terms,
            IERC20Metadata(deployment.shares).decimals(),
            futureOwner
        );

        emit TokenDeploymentSource(deployment);
        return deployment;
    }
}
