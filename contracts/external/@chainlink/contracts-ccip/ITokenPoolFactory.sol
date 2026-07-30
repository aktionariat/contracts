// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

// Should not be needed to copy the contract on etherscan
// turn it into an interface, for contracts to work
// within a project because the code that is distributed
// does is not compatible with the code that is onchain

/// @notice A contract for deploying new tokens and token pools, and configuring them with the token admin registry
/// @dev At the end of the transaction, the ownership transfer process will begin, but the user must accept the
/// ownership transfer in a separate transaction.
/// @dev The address prediction mechanism is only capable of deploying and predicting addresses for EVM based chains.
/// adding compatibility for other chains will require additional offchain computation.
interface ITokenPoolFactory {
  event RemoteChainConfigUpdated(uint64 indexed remoteChainSelector, RemoteChainConfig remoteChainConfig);

  error InvalidZeroAddress();

  /// @notice The type of pool to deploy. Types may be expanded in future versions
  enum PoolType {
    BURN_MINT,
    LOCK_RELEASE
  }

  // From RateLimiter.sol
  struct Config {
    bool isEnabled; // Indication whether the rate limiting should be enabled
    uint128 capacity; // ────╮ Specifies the capacity of the rate limiter
    uint128 rate; //  ───────╯ Specifies the rate of the rate limiter
  }

  /// @dev This struct will only ever exist in memory and as calldata, and therefore does not need to be efficiently packed for storage. The struct is used to pass information to the create2 address generation function.
  struct RemoteTokenPoolInfo {
    uint64 remoteChainSelector; // The CCIP specific selector for the remote chain
    bytes remotePoolAddress; // The address of the remote pool to either deploy or use as is. If empty, address
    // will be predicted
    bytes remotePoolInitCode; // Remote pool creation code if it needs to be deployed, without constructor params
    // appended to the end.
    RemoteChainConfig remoteChainConfig; // The addresses of the remote RMNProxy, Router, factory, and token
    // decimals which are needed for determining the remote address
    PoolType poolType; // The type of pool to deploy, either Burn/Mint or Lock/Release
    bytes remoteTokenAddress; // EVM address for remote token. If empty, the address will be predicted
    bytes remoteTokenInitCode; // The init code to be deployed on the remote chain and includes constructor params
    Config rateLimiterConfig; // Token Pool rate limit. Values will be applied on incoming an outgoing messages
  }

  // solhint-disable-next-line gas-struct-packing
  struct RemoteChainConfig {
    address remotePoolFactory; // The factory contract on the remote chain which will make the deployment
    address remoteRouter; // The router on the remote chain
    address remoteRMNProxy; // The RMNProxy contract on the remote chain
    uint8 remoteTokenDecimals; // The number of decimals for the token on the remote chain
  }

  // // ================================================================
  // // │                   Top-Level Deployment                       │
  // // ================================================================

  /// @notice Deploys a token and token pool with the given token information and configures it with remote token pools
  /// @dev The token and token pool are deployed in the same transaction, and the token pool is configured with the
  /// remote token pools. The token pool is then set in the token admin registry. Ownership of the everything is transferred
  /// to the msg.sender, but must be accepted in a separate transaction due to 2-step ownership transfer.
  /// @param remoteTokenPools An array of remote token pools info to be used in the pool's applyChainUpdates function
  /// or to be predicted if the pool has not been deployed yet on the remote chain
  /// @param localTokenDecimals The amount of decimals to be used in the new token. Since decimals() is not part of the
  /// the ERC20 standard, and thus cannot be certain to exist, the amount must be supplied via user input.
  /// @param tokenInitCode The creation code for the token, which includes the constructor parameters already appended
  /// @param tokenPoolInitCode The creation code for the token pool, without the constructor parameters appended
  /// @param salt The salt to be used in the create2 deployment of the token and token pool to ensure a unique address
  /// @return token The address of the token that was deployed
  /// @return pool The address of the token pool that was deployed
  function deployTokenAndTokenPool(
    RemoteTokenPoolInfo[] calldata remoteTokenPools,
    uint8 localTokenDecimals,
    bytes memory tokenInitCode,
    bytes calldata tokenPoolInitCode,
    bytes32 salt
  ) external returns (address, address);

  /// @notice Deploys a token pool with an existing ERC20 token
  /// @dev Since the token already exists, this contract is not the owner and therefore cannot configure the
  /// token pool in the token admin registry in the same transaction. The user must invoke the calls to the
  /// tokenAdminRegistry manually
  /// @dev since the token already exists, the owner must grant the mint and burn roles to the pool manually
  /// @param token The address of the existing token to be used in the token pool
  /// @param localTokenDecimals The amount of decimals used in the existing token. Since decimals() is not part of the
  /// the ERC20 standard, and thus cannot be certain to exist, the amount must be supplied via user input.
  /// @param remoteTokenPools An array of remote token pools info to be used in the pool's applyChainUpdates function
  /// @param tokenPoolInitCode The creation code for the token pool
  /// @param salt The salt to be used in the create2 deployment of the token pool
  /// @return poolAddress The address of the token pool that was deployed
  function deployTokenPoolWithExistingToken(
    address token,
    uint8 localTokenDecimals,
    RemoteTokenPoolInfo[] calldata remoteTokenPools,
    bytes calldata tokenPoolInitCode,
    bytes32 salt,
    PoolType poolType
  ) external returns (address);
}
