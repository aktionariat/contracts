// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { AllowlistDraggableFactory } from "./AllowlistDraggableFactory.sol";
import { AllowlistShares, Shares } from "../../shares/AllowlistShares.sol";
import { DraggableTokenFactory } from "./DraggableTokenFactory.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { TokenConfig } from "./FactoryStructs.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { Ownable } from "../Ownable.sol";

/**
 * @title TokenFactory
 * @author rube
 * @author muratogat
 * 
 * @dev Factory to deploy shares contracts
 * @notice This contract allows the creation of share tokens with optional draggable functionality and allowlist features.
 */
contract TokenFactory is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;
  
  // Version history
  // 1: Initial version
  // 2: Allowlisting functionality always available
  uint8 public constant VERSION = 2;

  /// @notice Factory manager contract
  FactoryManager public manager;

  /// @notice Allowlist draggable token factory contract
  AllowlistDraggableFactory public allowlistDraggableFactory;

  /// @dev Set of addresses for created share tokens
  EnumerableSet.AddressSet private _sharesSet; 

  /// @dev Set of addresses for created draggable tokens
  EnumerableSet.AddressSet private _draggableSet; 

  /// @notice Emitted when a base token is created
  /// @param token The created token
  /// @param owner The owner of the token
  /// @param allowlist Indicates if the token has an allowlist
  event BaseTokenCreated(IERC20Permit indexed token, address indexed owner, bool allowlist);

  /// @notice Emitted when a draggable token is created
  /// @param draggable The created draggable token
  /// @param baseToken The base token associated with the draggable token
  /// @param owner The owner of the draggable token
  /// @param allowlist Indicates if the token has an allowlist
  event DraggableTokenCreated(IERC20Permit indexed draggable, IERC20Permit indexed baseToken, address indexed owner, bool allowlist);

  /// @notice Emitted when the factory manager is updated
  /// @param manager The new factory manager
  event FactoryManagerUpdated(address manager);

  /// @notice Emitted when the draggable token factory is updated
  /// @param factory The new draggable token factory
  event DraggableTokenFactoryUpdated(DraggableTokenFactory factory);

  /// @notice Emitted when the allowlist draggable token factory is updated
  /// @param factory The new allowlist draggable token factory
  event AllowlistDraggableFactoryUpdated(AllowlistDraggableFactory factory);

  /// @notice Error for invalid owner address
  error InvalidOwner();

  /**
   * @notice Constructor for TokenFactory
   * @param _owner The address of the contract owner
   * @param _allowlistDraggableFactory The address of the allowlist draggable token factory
   */
  constructor(address _owner, AllowlistDraggableFactory _allowlistDraggableFactory) Ownable(_owner) {
    allowlistDraggableFactory = _allowlistDraggableFactory;
  }

  /**
   * @notice Creates a new token
   * @param tokenConfig Configuration of the token to be created
   * @param tokenOwner The owner of the new token
   * @return The address of the created token
   */
  function createToken(TokenConfig calldata tokenConfig, address tokenOwner, string calldata salt) external returns (IERC20Permit) {
    if (tokenOwner == address(0)) revert InvalidOwner();
    IERC20Permit token = _createBaseToken(tokenConfig, tokenOwner, salt);
    if (tokenConfig.draggable) {
      IERC20Permit draggable = _createDraggableToken(tokenConfig, tokenOwner, token, salt);
      return draggable;
    } else {
      return token;
    }
  }

  function predictTokenAddress(TokenConfig calldata tokenConfig, address tokenOwner, string calldata salt) external view returns (address) {
    bytes32 saltHash = bytes32(uint256(keccak256(abi.encodePacked(tokenConfig.symbol, salt))));
    bytes32 initCodeHash = keccak256(abi.encodePacked(type(AllowlistShares).creationCode, abi.encode(tokenConfig.symbol, tokenConfig.name, tokenConfig.terms, tokenConfig.numberOfShares, manager.recoveryHub(), tokenOwner, manager.permit2Hub())));
    bytes32 hashResult = keccak256(abi.encodePacked(bytes1(0xff), address(this), saltHash, initCodeHash));
    address baseTokenAddress = address(uint160(uint256(hashResult)));

    if (tokenConfig.draggable) {
      return allowlistDraggableFactory.predictAllowlistDraggableAddress(tokenConfig, tokenOwner, IERC20Permit(baseTokenAddress), salt);
    } else {
      return baseTokenAddress;
    }
  }

  /**
   * @notice Sets the factory manager
   * @param _manager The new factory manager
   */
  function setManager(FactoryManager _manager) external onlyOwner() {
    manager = _manager;
    emit FactoryManagerUpdated(address(manager));
  }

  /**
   * @notice Sets the allowlist draggable token factory
   * @param _allowlistDraggableFactory The new allowlist draggable token factory
   */
  function setAllowlistDraggableFactory(AllowlistDraggableFactory _allowlistDraggableFactory) external onlyOwner() {
    allowlistDraggableFactory = _allowlistDraggableFactory;
    emit AllowlistDraggableFactoryUpdated(allowlistDraggableFactory);
  }

  /**
   * @notice Gets all created share tokens
   * @return An array of addresses of created share tokens
   */
  function getAllShares() external view returns (address[] memory) {
    return _sharesSet.values();
  }

  /**
   * @notice Gets all created draggable share tokens
   * @return An array of addresses of created draggable share tokens
   */
  function getAllDraggableShares() external view returns (address[] memory) {
    return _draggableSet.values();
  }

  function _createBaseToken(TokenConfig calldata tokenConfig, address tokenOwner, string calldata _salt) internal returns (IERC20Permit token) {
    bytes32 salt = bytes32(uint256(keccak256(abi.encodePacked(tokenConfig.symbol, _salt))));
    token = new AllowlistShares{salt: salt}(tokenConfig.symbol, tokenConfig.name, tokenConfig.terms, tokenConfig.numberOfShares, manager.recoveryHub(), tokenOwner, manager.permit2Hub());
    _sharesSet.add(address(token));
    emit BaseTokenCreated(token, tokenOwner, true);
    return token;
  }

  function _createDraggableToken(TokenConfig calldata tokenConfig, address tokenOwner, IERC20Permit baseToken, string calldata _salt) internal returns (IERC20Permit draggable) {
    draggable = allowlistDraggableFactory.createAllowlistDraggable(tokenConfig, tokenOwner, baseToken, _salt);
    _draggableSet.add(address(draggable));
    emit DraggableTokenCreated(draggable, baseToken, tokenOwner, true);
    return draggable;
  }
}
