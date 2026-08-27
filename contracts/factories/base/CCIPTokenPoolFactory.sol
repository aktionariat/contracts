// SPDX-License-Identifier: LicenseRef-Aktionariat
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {TokenPoolFactory} from "@chainlink/contracts-ccip/contracts/tokenAdminRegistry/TokenPoolFactory/TokenPoolFactory.sol";

import {OwnableBytecodeStore} from "./OwnableBytecodeStore.sol";
import {Deployment} from "../lib/Deployment.sol";
import {ChainlinkService} from "../lib/ChainlinkService.sol";

/**
 * @title CCIPTokenPoolFactory
 * @notice Abstract base for factories that deploy a CCIP Token Pool through
 *         Chainlink's `TokenPoolFactory` and configure the full CCIP
 *         infrastructure. Stores both the pool creation bytecode and the
 *         Chainlink infrastructure addresses.
 * @dev Subclasses provide the pool type (`_poolType`) and an optional
 *      post-deploy hook (`_postDeploy`) for pool-type-specific setup.
 */
abstract contract CCIPTokenPoolFactory is OwnableBytecodeStore {
    ChainlinkService.ChainlinkAddresses public chainlinkAddresses;

    event ChainlinkAddressesUpdated(ChainlinkService.ChainlinkAddresses indexed newChainlinkAddresses);
    event PoolDeployed(address indexed pool, address indexed token);

    constructor(
        bytes memory initialBytecode,
        ChainlinkService.ChainlinkAddresses memory initialChainlinkAddresses
    ) OwnableBytecodeStore(initialBytecode) {
        ChainlinkService._validateChainlinkAddresses(initialChainlinkAddresses);
        chainlinkAddresses = initialChainlinkAddresses;
    }

    function setChainlinkAddresses(ChainlinkService.ChainlinkAddresses memory newChainlinkAddresses) external onlyOwner {
        ChainlinkService._validateChainlinkAddresses(newChainlinkAddresses);
        chainlinkAddresses = newChainlinkAddresses;
        emit ChainlinkAddressesUpdated(newChainlinkAddresses);
    }

    /**
     * @notice The TokenPoolFactory PoolType this factory deploys.
     */
    function _poolType() internal view virtual returns (TokenPoolFactory.PoolType);

    /**
     * @notice ABI-encodes the Token Pool constructor arguments.
     * @dev    Differs between pool types (e.g. LockRelease takes an extra
     *         `acceptLiquidity` boolean).
     */
    function _encodePoolConstructorArgs(address token, uint8 decimals) internal view virtual returns (bytes memory);

    /**
     * @notice Optional pool-type-specific setup after deployment, before the
     *         CCIP infrastructure settings are applied. Override to no-op.
     */
    function _postDeploy(address pool, address localToken) internal virtual {
        pool;
        localToken;
    }

    /**
     * @notice Predict the CREATE2 address as Chainlink's TokenPoolFactory would
     *         see it.
     * @dev    Applies the chainlink' salt transformation:
     *         actualSalt = keccak256(abi.encodePacked(salt, address(this))).
     */
    function predict(
        bytes32 salt,
        address token,
        uint8 decimals
    ) external view returns (address) {
        bytes32 actualSalt = keccak256(abi.encodePacked(salt, address(this)));
        return Deployment.compute(
            bytecode,
            chainlinkAddresses.tokenPoolFactory,
            actualSalt,
            _encodePoolConstructorArgs(token, decimals)
        );
    }

    /**
     * @notice Deploy a Token Pool through Chainlink's TokenPoolFactory and
     *         configure the full CCIP infrastructure.
     * @dev    The local token must already be owned by this contract.
     */
    function deploy(
        bytes32 salt,
        address localToken,
        TokenPoolFactory.RemoteTokenPoolInfo[] calldata remoteTokenPools,
        address futureOwner
    ) external returns (address deployedPool) {
        Deployment._isContractOwner(localToken, address(this));
        if (futureOwner == address(0)) {
            futureOwner = msg.sender;
        }

        deployedPool = TokenPoolFactory(chainlinkAddresses.tokenPoolFactory).deployTokenPoolWithExistingToken(
            localToken,
            IERC20Metadata(localToken).decimals(),
            remoteTokenPools,
            bytecode,
            salt,
            _poolType()
        );

        _postDeploy(deployedPool, localToken);

        ChainlinkService._applySettingToChainlinkCCIPInfrastructure(
            deployedPool,
            localToken,
            futureOwner,
            chainlinkAddresses.registryModuleOwner,
            chainlinkAddresses.tokenAdminRegistry
        );

        Ownable(localToken).transferOwnership(futureOwner);

        emit PoolDeployed(deployedPool, localToken);
    }
}
