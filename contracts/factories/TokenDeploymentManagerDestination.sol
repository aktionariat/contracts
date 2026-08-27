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

import {BridgedSHAFactory} from "./logics/BridgedSHAFactory.sol";
import {CCIPBurnMintTokenPoolFactory} from "./logics/CCIPBurnMintTokenPoolFactory.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";

contract TokenDeploymentManagerDestination is Ownable {
    // if ever to be changed, interface contracts changed
    BridgedSHAFactory public immutable bridgedSHAFactory;
    CCIPBurnMintTokenPoolFactory public immutable burnMintTokenPoolFactory;

    struct BridgedSharesUnderAgreementDeploymentData {
        address candidate;
        // constructor arguments
        string symbol;
        string name;
        string terms;
    }

    struct DestinationParams {
        BridgedSharesUnderAgreementDeploymentData bridgedSharesUnderAgreement;
        TokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
    }

    struct TokenDeployment {
        address bridgedSharesUnderAgreement;
    }

    struct TokenPoolDeployment {
        address burnMintTokenPool;
    }

    struct DestinationDeployment {
        TokenDeployment token;
        TokenPoolDeployment tokenPool;
    }

    error InvalidAddress();

    constructor(
        BridgedSHAFactory _bridgedSHAFactory,
        CCIPBurnMintTokenPoolFactory _burnMintTokenPoolFactory
    ) Ownable(msg.sender) {
        if (
            address(_bridgedSHAFactory) == address(0) || address(_burnMintTokenPoolFactory) == address(0)
        ) {
            revert InvalidAddress();
        }
        bridgedSHAFactory = _bridgedSHAFactory;
        burnMintTokenPoolFactory = _burnMintTokenPoolFactory;
    }

    /**
     * @notice Predicts every address that `deploy` would create for the given
     *         inputs, assuming all tokens are deployed fresh (candidates ignored).
     */
    function predict(BridgedSharesUnderAgreementDeploymentData calldata bshaParams, bytes32 salt) external view returns (DestinationDeployment memory predictedDeployment) {
        // BSHA must be owned by the pool logic factory so it can set up CCIP.
        predictedDeployment.token.bridgedSharesUnderAgreement = bridgedSHAFactory.predict(
            salt,
            bshaParams.symbol,
            bshaParams.name,
            bshaParams.terms,
            address(burnMintTokenPoolFactory)
        );

        // decimals are always 0 for BSHA.
        predictedDeployment.tokenPool.burnMintTokenPool = burnMintTokenPoolFactory.predict(
            salt,
            predictedDeployment.token.bridgedSharesUnderAgreement,
            0
        );
    }

    /**
     * @notice Deploys the whole destination-chain infrastructure:
     *         BridgedSharesUnderAgreement and the BurnMint Token Pool with its
     *         CCIP settings.
     *
     * For backward compatibility, an already deployed BSHA can be supplied
     * through its `candidate`. When a BSHA candidate is given, it must already
     * be owned by the burn-mint pool logic factory (which will take care of the
     * pool and hand ownership over to `futureOwner`).
     */
    function deploy(DestinationParams calldata params, address futureOwner, bytes32 salt) external onlyOwner returns (DestinationDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // // Token Deployment
        if (params.bridgedSharesUnderAgreement.candidate != address(0)) {
            // use existing BSHA
            deployment.token.bridgedSharesUnderAgreement = params.bridgedSharesUnderAgreement.candidate;
        } else {
            // deploy BSHA, owned by the pool logic factory so it can set up CCIP
            deployment.token.bridgedSharesUnderAgreement = bridgedSHAFactory.deploy(
                salt,
                params.bridgedSharesUnderAgreement.symbol,
                params.bridgedSharesUnderAgreement.name,
                params.bridgedSharesUnderAgreement.terms,
                address(burnMintTokenPoolFactory)
            );
        }

        // // Token Pool Deployment
        deployment.tokenPool.burnMintTokenPool = burnMintTokenPoolFactory.deploy(
            salt,
            deployment.token.bridgedSharesUnderAgreement,
            params.remoteTokenPools,
            futureOwner
        );

        return deployment;
    }
}
