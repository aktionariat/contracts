
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.0;

import "./LockupShares.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/// @title Lockup Factory
/// @notice A factory to create lockupShares contracts
contract LockupFactory {

  /// @return Address of the lockup shares implementation.
  address immutable public lockupSharesImplementation;

  /// @notice Emitted when new lockup contract is created.
  /// @param contractAddress Address of the new created contract.
  /// @param typeName type of the contract.
  event ContractCreated(address indexed contractAddress, string indexed typeName);

  constructor(address _lockupSharesImplementation) {
    lockupSharesImplementation = _lockupSharesImplementation;
  }
  
  /// @notice Predicts the address of the contract.
  /// @param salt The unique salt for this contract creation.
  /// @return The predicted contract address.
  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(lockupSharesImplementation, salt);
  }

  /// @notice Creates a new lockup contract.
  /// @param owner The beneficiary address of the locked up tokens.
  /// @param company The company address of the token that gets locked up.
  /// @param token The token address of the locked up tokens.
  /// @param lockupPeriod The period until when the token is locked up.
  /// @param salt The unique salt for the contract creation.
  /// @return The address of the new created contract
  function create(address owner, address company, IERC20 token, uint256 lockupPeriod, bytes32 salt) external returns (LockupShares) {
    address payable instance = payable(Clones.cloneDeterministic(lockupSharesImplementation, salt));
    emit ContractCreated(instance, "LockupShares");
    LockupShares(instance).initialize(owner, company, token, lockupPeriod);
    return LockupShares(instance);
  }
}