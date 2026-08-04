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

import {BridgedSharesUnderAgreement} from "./BridgedSharesUnderAgreement.sol";
import {Deployment} from "./library/deployment.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// Again, this had to be saved from on-chain as library does not provide the exact
// on-chain interface
import {ITokenPoolFactory} from "../vendor/@chainlink/contracts-ccip/ITokenPoolFactory.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/contracts/interfaces/ITokenAdminRegistry.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";
import {RegistryModuleOwnerCustom} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/RegistryModuleOwnerCustom.sol";

contract CCIPFactoryDestination is Ownable {
    error TestError();

    error UnableToPerformSetupCCIP_CanOnlySelfRegister(address actualOwner, address neededOwner);
    error InvalidAddress();

    event DestinationBridgedSharesUnderAgreementResolved(address indexed sourceWrapper, bool wasDeployed);
    event DestinationTokenPoolDeployed(address indexed pool);

    struct ChainlinkAddresses {
        address tokenAdminRegistry;
        address registryModuleOwner;
        address tokenPoolFactory;
    }

    struct BridgedSharesUnderAgreementDeploymentData {
        address candidate;
        bytes contractBytecode;
        // constructor arguments
        string symbol;
        string name;
        string terms;
    }

    struct DestinationParams {
        BridgedSharesUnderAgreementDeploymentData bridgedSharesUnderAgreement;
        ChainlinkAddresses chainlink;
        bytes burnMintTokenPoolBytecode;
        // Prediction of addresses is left either to backend
        // or to chainlink token pool factory
        ITokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
        bytes32 salt;
    }

    struct DestinationDeployment {
        address bridgedSharesUnderAgreement;
        address brunMintTokenPool;
    }

    constructor() Ownable(msg.sender) {}

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

        // // Token Deployment
        // Bridged Shares Under Agreement
        Deployment.DeploymentData memory bshaDeploymentData = Deployment.DeploymentData({
            candidate: params.bridgedSharesUnderAgreement.candidate,
            contractBytecode: params.bridgedSharesUnderAgreement.contractBytecode,
            constructorArgumentsBytecode: abi.encode(params.bridgedSharesUnderAgreement.symbol, params.bridgedSharesUnderAgreement.name, params.bridgedSharesUnderAgreement.terms, address(this))
        });
        (deployment.bridgedSharesUnderAgreement, wasDeployed) = Deployment._resolveAddressOrDeploy(bshaDeploymentData, params.salt);
        if (deployment.bridgedSharesUnderAgreement == address(0)) revert InvalidAddress();
        emit DestinationBridgedSharesUnderAgreementResolved(deployment.bridgedSharesUnderAgreement, wasDeployed);

        // Ensure the deployer is the owner
        address bshaOwner = IOwnable(deployment.bridgedSharesUnderAgreement).owner();
        if (bshaOwner != address(this)) {
            revert UnableToPerformSetupCCIP_CanOnlySelfRegister(bshaOwner, address(this));
        }

        // // Pool Deployment
        // Note that salt will be computed as:
        // salt = keccak256(abi.encodePacked(salt, msg.sender));
        // Within factory

        // LockRelease Pool Deployment through Chainlink Factory Deployment
        // address token,
        // uint8 localTokenDecimals,
        // RemoteTokenPoolInfo[] calldata remoteTokenPools,
        // bytes calldata tokenPoolInitCode,
        // bytes32 salt,
        // PoolType poolType
        deployment.brunMintTokenPool = ITokenPoolFactory(params.chainlink.tokenPoolFactory).deployTokenPoolWithExistingToken(
            deployment.bridgedSharesUnderAgreement,
            IERC20Metadata(deployment.bridgedSharesUnderAgreement).decimals(),
            params.remoteTokenPools,
            params.burnMintTokenPoolBytecode,
            params.salt,
            ITokenPoolFactory.PoolType.BURN_MINT
        );
        emit DestinationTokenPoolDeployed(deployment.brunMintTokenPool);
        // now factory owns the pool, and it is deployed
        // Ownership of TokenPool in is now pending for Factory in LockReleaseTokenPool

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
}
