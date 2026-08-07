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

import {BridgedSharesUnderAgreement} from "../multichain/BridgedSharesUnderAgreement.sol";
import {Deployment} from "../utils/Deployment.sol";
import {TokenPoolInitialization} from "./lib/TokenPoolInitialization.sol";
import {FactoryCCIP} from "./lib/FactoryCCIP.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";

contract FactoryDestination is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event BridgedSharesUnderAgreementLogicResolved(address indexed sourceWrapper);
    event TokenPoolLogicResolved(address indexed sourceWrapper);

    event BridgedSharesUnderAgreementDeployed(address indexed proxyWrapper, string symbol);
    event TokenPoolDeployed(address indexed proxyPool);

    struct ChainlinkAddresses {
        address tokenAdminRegistry;
        address registryModuleOwner;
        // needed for proxy token pool
        address rmnProxy;
        address router;
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
        TokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
    }

    struct DestinationDeployment {
        address bridgedSharesUnderAgreement;
        address brunMintTokenPool;
    }

    address public BSHA_IMPLEMENTATION;
    address public TOKEN_POOL_IMPLEMENTATION;

    /**
     * Factory Constructor.
     * Sets the BSHA logic contract address.
     *
     * @dev We initialize at constructor since the code is initialization-dependent, that is
     *      if we change the BSHA contract initialization call we would need to chnage the code
     *      also in the factory
     *
     * @param bshaLogicContract the BSHA logic contract address
     * @param tokenPoolLogicContract the TokenPool logic contract address
     */
    constructor(address bshaLogicContract, address tokenPoolLogicContract) Ownable(msg.sender) {
        // BridgedSharesUnderAgreement Logic
        BSHA_IMPLEMENTATION = bshaLogicContract;
        emit BridgedSharesUnderAgreementLogicResolved(bshaLogicContract);

        TOKEN_POOL_IMPLEMENTATION = tokenPoolLogicContract;
        emit TokenPoolLogicResolved(tokenPoolLogicContract);
    }

    /**
     *	Deploys the bSHA contract if needed and enabes the CCIP infrastructure.
     *
     * @notice onlyOwner is not strictly necessary.
     * @dev You need sure that the true owner has the ability to accept ownership of TokenPool and the
     *      Token on the TokenAdminRegistry after the call.
     *      If bSHA contract is passed by candidate, make sure that the owner of it is the factory pool,
     *      otherwise registerAdminViaOwner will fail.
     * @param params deployment parameters.
     * @return deployment deployed addresses struct, comprehends bSHA and the burn mint pool.
     */
    function deploy(DestinationParams calldata params, address futureOwner) external onlyOwner returns (DestinationDeployment memory deployment) {
        // Move admin to deployer for all contracts
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // we already compute the salt over token symbol (which should be an unique identifier)
        // and msg sender
        bytes32 salt = keccak256(abi.encodePacked(params.bridgedSharesUnderAgreement.symbol, msg.sender));

        // // Proxy Token Deployment
        // deploys a minimal proxy (EIP-1167) with BSHA_IMPLEMENTATION business logic
        if (params.bridgedSharesUnderAgreement.candidate != address(0)) {
            // use existing token to initialize it
            deployment.bridgedSharesUnderAgreement = params.bridgedSharesUnderAgreement.candidate;
        } else {
            // deploy proxy
            deployment.bridgedSharesUnderAgreement = Clones.cloneDeterministic(BSHA_IMPLEMENTATION, salt);

            // initialize
            BridgedSharesUnderAgreement(deployment.bridgedSharesUnderAgreement).initialize(
                params.bridgedSharesUnderAgreement.symbol,
                params.bridgedSharesUnderAgreement.name,
                params.bridgedSharesUnderAgreement.terms,
                address(this)
            );
        }
        // emit
        emit BridgedSharesUnderAgreementDeployed(deployment.bridgedSharesUnderAgreement, IERC20Metadata(deployment.bridgedSharesUnderAgreement).symbol());

        // Ensure the deployer is the owner
        address bshaOwner = IOwnable(deployment.bridgedSharesUnderAgreement).owner();
        if (bshaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(bshaOwner, address(this));
        }

        // // Pool Proxy Deployment
        // Deploys Token Pool Proxy: Only if applicable
        deployment.brunMintTokenPool = TokenPoolInitialization._deployProxyTokenPool(
            TOKEN_POOL_IMPLEMENTATION,
            deployment.bridgedSharesUnderAgreement,
            IERC20Metadata(deployment.bridgedSharesUnderAgreement).decimals(),
            TokenPoolFactory.PoolType.BURN_MINT,
            params.chainlink.rmnProxy,
            params.chainlink.router,
            salt
        );
        TokenPoolInitialization._applyChainUpdatesTokenPool(deployment.brunMintTokenPool, params.remoteTokenPools, address(this), salt);
        emit TokenPoolDeployed(deployment.brunMintTokenPool);

        // set pool as minter and burner in bSHA
        BridgedSharesUnderAgreement(deployment.bridgedSharesUnderAgreement).setPool(deployment.brunMintTokenPool);

        // // // Further settings do require only BSHA and Pool addresses
        FactoryCCIP._applySettingToChainlinkCCIPInfrastructure(
            deployment.brunMintTokenPool,
            deployment.bridgedSharesUnderAgreement,
            futureOwner,
            params.chainlink.registryModuleOwner,
            params.chainlink.tokenAdminRegistry
        );

        // transfer Shares and SHA ownership to deployer (or address)
        IOwnable(deployment.bridgedSharesUnderAgreement).transferOwnership(futureOwner);
        // no need to accept ownership here
        return deployment;
    }
}
