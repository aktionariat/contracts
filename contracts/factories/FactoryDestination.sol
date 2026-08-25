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

import {BridgedSharesUnderAgreement} from "../multichain/BridgedSharesUnderAgreement.sol";

import {CCIPService} from "./lib/CCIPService.sol";

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";

/**
 * FactoryDestination contract, to manage deployment and automatic CCIP integration.
 *
 * Tokens and pools are deployed via CREATE2 using externally provided bytecodes,
 * keeping the factory bytecode compact. Constructor arguments are ABI-encoded
 * and appended to the raw creation code before deployment.
 */
contract FactoryDestination is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event BridgedSharesUnderAgreementDeployed(address indexed wrapper, string symbol);
    event TokenPoolDeployed(address indexed pool);

    struct ChainlinkAddresses {
        address tokenPoolFactory;
        address tokenAdminRegistry;
        address registryModuleOwner;
    }

    struct BridgedSharesUnderAgreementDeploymentData {
        address candidate;
        bytes bytecode;
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
        // // Token Deployment
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
     * Deploys BridgedSharesUnderAgreement token via CREATE2 using externally provided raw creation bytecode.
     * Constructor arguments are ABI-encoded and appended to the bytecode before deployment.
     */
    function deployTokens(BridgedSharesUnderAgreementDeploymentData calldata bsha, address futureOwner, bytes32 salt) public onlyOwner returns(TokenDeployment memory deployment) {
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // Deploy BSHA via CREATE2
        bytes memory creationCode = abi.encodePacked(
            bsha.bytecode,
            abi.encode(bsha.symbol, bsha.name, bsha.terms, futureOwner)
        );
        deployment.bridgedSharesUnderAgreement = Create2.deploy(0, salt, creationCode);
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

        // Ensure the factory is the owner of BSHA
        address shaOwner = Ownable(bridgedSharesUnderAgreement).owner();
        if (shaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(shaOwner, address(this));
        }

        // // Chainlink Factory Token Pool Deployment
        // Burn Mint Pool Deployment through Chainlink Factory Deployment
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
        Ownable(bridgedSharesUnderAgreement).transferOwnership(futureOwner);
    }
}
