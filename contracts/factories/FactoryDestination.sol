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

import {BridgedSharesUnderAgreement} from "../multichain/BridgedSharesUnderAgreement.sol";

import {CCIPService} from "./lib/CCIPService.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";

contract FactoryDestination is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event BridgedSharesUnderAgreementDeployed(address indexed proxyWrapper, string symbol);
    event TokenPoolDeployed(address indexed proxyPool);

    struct ChainlinkAddresses {
        address tokenPoolFactory;
        address tokenAdminRegistry;
        address registryModuleOwner;
    }

    struct BridgedSharesUnderAgreementDeploymentData {
        address candidate;
        // constructor arguments
        string symbol;
        string name;
        string terms;
    }

    struct DestinationParams {
        BridgedSharesUnderAgreementDeploymentData bridgedSharesUnderAgreement;
        ChainlinkAddresses chainlink;
        bytes burnMintTokenPoolBytecode;
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

    constructor() Ownable(msg.sender) {}

    /**
     * Deploys BSHA and TokenPool contracts, then sets the CCIP infrastructure to enable bridging via CCT.
     *
     * For backward compatibility we accept also already deployed BSHA do deployment setups.
     * For BSHA, owneship of shares should be given to the factory before calling this function.
     *
     * @notice see deployToken and deployTokenBridge requirements
     */
    function deploy(DestinationParams calldata params, address futureOwner, bytes32 salt) external onlyOwner returns (DestinationDeployment memory deployment) {
        // // Proxy Token Deployment
        if (params.bridgedSharesUnderAgreement.candidate != address(0)) {
            // use existing token to initialize it
            deployment.token.bridgedSharesUnderAgreement = params.bridgedSharesUnderAgreement.candidate;
            // we defer check of ownership to the deployTokenBridge function
        } else {
            // call deployment
            deployment.token = deployTokens(
                params.bridgedSharesUnderAgreement, address(this), salt
            );
        }

        // // Token Pool Deployment
        deployment.tokenPool = deployTokenBridge(
            deployment.token.bridgedSharesUnderAgreement,
            params.chainlink,
            params.burnMintTokenPoolBytecode,
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
    function deployTokens(BridgedSharesUnderAgreementDeploymentData calldata bsha, address futureOwner, bytes32 salt) public onlyOwner returns(TokenDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // we skip candiate here
        deployment.bridgedSharesUnderAgreement  = address(
            new BridgedSharesUnderAgreement{salt: salt}(
                bsha.symbol,
                bsha.name,
                bsha.terms,
                futureOwner // no need for deployer ownership
            )
        );
        emit BridgedSharesUnderAgreementDeployed(deployment.bridgedSharesUnderAgreement, IERC20Metadata(deployment.bridgedSharesUnderAgreement).symbol());
    }

    /**
     * Deploys the token pool and sets up the CCIP Bridge infrastructure
     */
    function deployTokenBridge(
        address bridgedSharesUnderAgreement,
        ChainlinkAddresses calldata chainlink,
        bytes calldata burnMintTokenPoolBytecode,
        TokenPoolFactory.RemoteTokenPoolInfo[] calldata remoteTokenPools,
        address futureOwner,
        bytes32 salt
    ) public onlyOwner returns(TokenPoolDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // Ensure the factory is the owner of SHA, Shares' owner is not a problem
        address shaOwner = IOwnable(bridgedSharesUnderAgreement).owner();
        if (shaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(shaOwner, address(this));
        }

        // // Chainlink Factory Token Pool Deployment
        // Burn Mint Pool Deployment through Chainlink Factory Deployment
        // address token,
        // uint8 localTokenDecimals,
        // RemoteTokenPoolInfo[] calldata remoteTokenPools,
        // bytes calldata tokenPoolInitCode,
        // bytes32 salt,
        // PoolType poolType
        deployment.burnMintTokenPool = TokenPoolFactory(chainlink.tokenPoolFactory).deployTokenPoolWithExistingToken(
            bridgedSharesUnderAgreement,
            IERC20Metadata(bridgedSharesUnderAgreement).decimals(),
            remoteTokenPools,
            burnMintTokenPoolBytecode,
            salt,
            TokenPoolFactory.PoolType.BURN_MINT
        );
        emit TokenPoolDeployed(deployment.burnMintTokenPool);

        // set pool as minter and burner in BSHA
        BridgedSharesUnderAgreement(bridgedSharesUnderAgreement).setPool(deployment.burnMintTokenPool);

        // // Further Pool settings do require only SHA and Pool addresses
        CCIPService._applySettingToChainlinkCCIPInfrastructure(
            deployment.burnMintTokenPool,
            bridgedSharesUnderAgreement,
            futureOwner,
            chainlink.registryModuleOwner,
            chainlink.tokenAdminRegistry
        );

        // transfer BSHA ownership to futureOwner
        IOwnable(bridgedSharesUnderAgreement).transferOwnership(futureOwner);
    }
}
