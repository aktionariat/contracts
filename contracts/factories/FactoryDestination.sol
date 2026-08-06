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
// import {TokenPoolInitialization} from "../multichain/lib/TokenPoolInitialization.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/contracts/interfaces/ITokenAdminRegistry.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";
import {RegistryModuleOwnerCustom} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/RegistryModuleOwnerCustom.sol";

contract FactoryDestination is Ownable {
    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event DestinationTokenPoolLogicResolved(address indexed sourceWrapper, bool wasDeployed);
    event DestinationBridgedSharesUnderAgreementLogicResolved(address indexed sourceWrapper, bool wasDeployed);
    event DestinationBridgedSharesUnderAgreementResolved(address indexed sourceWrapper, bool wasDeployed);
    event DestinationTokenPoolDeployed(address indexed pool);

    struct ChainlinkAddresses {
        address tokenAdminRegistry;
        address registryModuleOwner;
        // // needed for proxy token pool
        // address rmnProxy;
        // address router;

        // needed for CCIP factory token pool: Only if not applicable
        address tokenPoolFactory;
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
        // Token Pool Bytecode: Only if not applicable
        bytes burnMintTokenPoolBytecode;
        TokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
        bytes32 salt;
    }

    struct DestinationDeployment {
        address bridgedSharesUnderAgreement;
        address brunMintTokenPool;
    }

    address public BSHA_IMPLEMENTATION;
    address public TOKEN_POOL_AKT_IMPLEMENTATION;

    /**
     * Factory Constructor.
     * Sets the BSHA logic contract address.
     *
     * @dev We initialize at constructor since the code is initialization-dependent, that is
     *      if we change the BSHA contract initialization call we would need to chnage the code
     *      also in the factory
     *
     * @param bshaLogicContract the BSHA logic contract deployment data
     * @param salt deployment salt
     */
    constructor(Deployment.DeploymentData memory bshaLogicContract, bytes32 salt) Ownable(msg.sender) {
        bool wasDeployed;
        address deploymentAddress;

        // Deploys a new version of the token business logic.
        // It is not a migration, it is a fixed upgrade of the token business logic.
        // The constructor is not necessary, you can also set an addres without deployment if passed as candidate.
        (deploymentAddress, wasDeployed) = Deployment._resolveAddressOrDeploy(bshaLogicContract, salt);
        BSHA_IMPLEMENTATION = deploymentAddress;
        emit DestinationBridgedSharesUnderAgreementLogicResolved(deploymentAddress, wasDeployed);

        // // Deploys Token Pool Logic: Only if applicable
        // (deploymentAddress, wasDeployed) = Deployment._resolveAddressOrDeploy(tokenPoolAktLogicContract, salt);
        // TOKEN_POOL_AKT_IMPLEMENTATION = deploymentAddress;
        // emit DestinationBridgedSharesUnderAgreementLogicResolved(deploymentAddress, wasDeployed);
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
        bool wasDeployed;

        // // Proxy Token Deployment
        // deploys a minimal proxy (EIP-1167) with BSHA_IMPLEMENTATION business logic
        if (params.bridgedSharesUnderAgreement.candidate == address(0)) {
            // use existing token to initialize it
            deployment.bridgedSharesUnderAgreement = params.bridgedSharesUnderAgreement.candidate;
        } else {
            // deploy proxy
            deployment.bridgedSharesUnderAgreement = Clones.cloneDeterministic(BSHA_IMPLEMENTATION, params.salt);

            // initialize
            BridgedSharesUnderAgreement(deployment.bridgedSharesUnderAgreement).initialize(
                params.bridgedSharesUnderAgreement.symbol,
                params.bridgedSharesUnderAgreement.name,
                params.bridgedSharesUnderAgreement.terms,
                address(this)
            );
        }
        // emit
        emit DestinationBridgedSharesUnderAgreementResolved(deployment.bridgedSharesUnderAgreement, wasDeployed);

        // Ensure the deployer is the owner
        address bshaOwner = IOwnable(deployment.bridgedSharesUnderAgreement).owner();
        if (bshaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(bshaOwner, address(this));
        }

        // // Proxy also pool? Do it, but do not remove the current vanilla Chainlink initialization
        // // // Pool Proxy Deployment
        // // Deploys Token Pool Proxy: Only if applicable
        // deployment.brunMintTokenPool = TokenPoolInitialization._deployProxyTokenPool(
        //     TOKEN_POOL_AKT_IMPLEMENTATION,
        //     deployment.bridgedSharesUnderAgreement,
        //     IERC20Metadata(deployment.bridgedSharesUnderAgreement).decimals(),
        //     TokenPoolFactory.PoolType.BURN_MINT,
        //     params.chainlink.rmnProxy,
        //     params.chainlink.router,
        //     params.salt
        // );
        // TokenPoolInitialization._applyChainUpdatesTokenPool(deployment.brunMintTokenPool, params.remoteTokenPools, address(this));
        // emit DestinationTokenPoolDeployed(deployment.brunMintTokenPool);

        // // Factory Pool Deployment
        // LockRelease Pool Deployment through Chainlink Factory Deployment
        // address token,
        // uint8 localTokenDecimals,
        // RemoteTokenPoolInfo[] calldata remoteTokenPools,
        // bytes calldata tokenPoolInitCode,
        // bytes32 salt,
        // PoolType poolType
        deployment.brunMintTokenPool = TokenPoolFactory(params.chainlink.tokenPoolFactory).deployTokenPoolWithExistingToken(
            deployment.bridgedSharesUnderAgreement,
            IERC20Metadata(deployment.bridgedSharesUnderAgreement).decimals(),
            params.remoteTokenPools,
            params.burnMintTokenPoolBytecode,
            params.salt,
            TokenPoolFactory.PoolType.BURN_MINT
        );
        emit DestinationTokenPoolDeployed(deployment.brunMintTokenPool);
        // now factory owns the pool, and it is deployed
        // Ownership of TokenPool in is now pending for Factory in LockReleaseTokenPool

        // // // Further Pool settings do require only BSHA and Pool addresses

        // set pool as minter and burner in bSHA
        BridgedSharesUnderAgreement(deployment.bridgedSharesUnderAgreement).setPool(deployment.brunMintTokenPool);

        // // Settings
        // Ownership of TokenPool in TokenPool is pending: Accept ownership for Factory of TokenPool
        IOwnable(deployment.brunMintTokenPool).acceptOwnership();

        // Uses IOwner(token).owner() to set owner in the registry module
        // and checks that msg.sender is the token owner, that is only after accepting ownership
        // the user can call the function
        RegistryModuleOwnerCustom(params.chainlink.registryModuleOwner).registerAdminViaOwner(deployment.bridgedSharesUnderAgreement);
        // Ownership of Token in is now pending for Factory in TokenAdminRegistry

        // Accept admin role
        // Ownership of Token in TokenAdminRegistry is pending: Accept ownership for Factory of TokenPool
        ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).acceptAdminRole(deployment.bridgedSharesUnderAgreement);

        // Set pool, factory needs to be admin to do so
        // Setting of pool only viable by non-pending owner
        ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).setPool(deployment.bridgedSharesUnderAgreement, deployment.brunMintTokenPool);

        // Move admin to deployer for all contracts
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        // Transfer ownership of TokenPool in TokenPool to deployer (or address)
        IOwnable(deployment.brunMintTokenPool).transferOwnership(futureOwner);
        // Then deployer will have to accept it through call:
        // IOwnable(deployment.brunMintTokenPool).acceptOwnership();

        // Transfer ownership of Token in TokenAdminRegistry to deployer (or address)
        ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).transferAdminRole(deployment.bridgedSharesUnderAgreement, futureOwner);
        // Then deployer will have to accept Administration through call:
        // ITokenAdminRegistry(params.chainlink.tokenAdminRegistry).acceptAdminRole(deployment.bridgedSharesUnderAgreement);

        // transfer Shares and SHA ownership to deployer (or address)
        IOwnable(deployment.bridgedSharesUnderAgreement).transferOwnership(futureOwner);
        // no need to accept ownership here
        return deployment;
    }

    /**
     * Predicts an empty constructor contract deployment from the factory.
     * Useful for proxy contracts.
     *
     * @dev may be useless
     *
     * @param contractBytecode the bytecode of the contract
     * @param salt salt used for deployment
     * @return address of deployed contract
     */
    function predictAddressEmptyConstructorFromFactory(bytes calldata contractBytecode, bytes32 salt) public view returns (address) {
        return Deployment.predictCreate2Address(address(this), contractBytecode, bytes(""), salt);
    }
}
