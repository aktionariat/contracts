// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

import { Brokerbot } from "../../brokerbot/Brokerbot.sol";
import { BrokerbotFactory } from "./BrokerbotFactory.sol";
import { FactoryManager } from "./FactoryManager.sol";
import { TokenConfig, BrokerbotConfig } from "./FactoryStructs.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { MultiSigCloneFactory } from "../../multisig/MultiSigCloneFactory.sol";
import { Ownable } from "../Ownable.sol";
import { TokenFactory } from "./TokenFactory.sol";


/**
 * @title Aktionariat factory to deploy all contracts
 * @author muratogat
 * 
 * @dev This contract allows for the creation of companies including a multisig wallet, ERC20 token, and brokerbot.
 */
contract AktionariatFactory is Ownable {
  
  // Version history
  // 1: Initial version
  // 2: Creating company with existing multisig wallet, for multichain multisig deployment support
  uint8 public constant VERSION = 2;

  BrokerbotFactory public brokerbotFactory;
  TokenFactory public tokenFactory;
  FactoryManager public manager;

  /**
   * @dev Emitted when a new company is created.
   * @param multisig The address of the multisig wallet.
   * @param token The address of the created ERC20 token.
   * @param brokerbot The address of the created brokerbot.
   */
  event CompanyCreated(address indexed multisig, IERC20Permit indexed token, Brokerbot indexed brokerbot);

  /**
   * @dev Emitted when the FactoryManager is updated.
   * @param manager The new FactoryManager.
   */
  event FactoryManagerUpdated(FactoryManager manager);

  /**
   * @dev Emitted when the TokenFactory is updated.
   * @param tokenFactory The new TokenFactory.
   */
  event TokenFactoryUpdated(TokenFactory tokenFactory);

  /**
   * @dev Emitted when the BrokerbotFactory is updated.
   * @param brokerbotFactory The new BrokerbotFactory.
   */
  event BrokerbotFactoryUpdated(BrokerbotFactory brokerbotFactory);

  /**
   * @dev Initializes the contract by setting the owner.
   * @param _owner The address of the owner.
   */
  constructor(address _owner) Ownable(_owner) {}

  /**
   * @notice Creates a new company including a multisig wallet, ERC20 token, and brokerbot.
   * @param tokenConfig The configuration for the ERC20 token.
   * @param brokerbotConfig The configuration for the brokerbot.
   * @param signer The address of the signer for the multisig wallet.
   */
  function createCompany(TokenConfig calldata tokenConfig, BrokerbotConfig calldata brokerbotConfig, address signer, string calldata salt) public {
    address multisig = createMultisig(signer, tokenConfig.symbol, salt);
    IERC20Permit token = tokenFactory.createToken(tokenConfig, multisig, salt);
    Brokerbot brokerbot = brokerbotFactory.createBrokerbot(brokerbotConfig, token, multisig, salt);
    emit CompanyCreated(multisig, token, brokerbot);
  }

  /**
   * @notice Creates a new company including inclusing an ERC20 token and brokerbot. Does not create a multisig wallet.
   * @param tokenConfig The configuration for the ERC20 token.
   * @param brokerbotConfig The configuration for the brokerbot.
   * @param multisig The address of the existing multisig wallet.
   */
  function createCompanyExistingMultisig(TokenConfig calldata tokenConfig, BrokerbotConfig calldata brokerbotConfig, address multisig, string calldata salt) public {
    IERC20Permit token = tokenFactory.createToken(tokenConfig, multisig, salt);
    Brokerbot brokerbot = brokerbotFactory.createBrokerbot(brokerbotConfig, token, multisig, salt);
    emit CompanyCreated(multisig, token, brokerbot);
  }

  /**
   * @notice Creates a new company including a multisig wallet and ERC20 token (no brokerbot).
   * @param tokenConfig The configuration for the ERC20 token.
   * @param signer The address of the signer for the multisig wallet.
   */
  function createCompanyWithoutBrokerbot(TokenConfig calldata tokenConfig, address signer, string calldata salt) public {
    address multisig = createMultisig(signer, tokenConfig.symbol, salt);
    IERC20Permit token = tokenFactory.createToken(tokenConfig, multisig, salt);
    emit CompanyCreated(multisig, token, Brokerbot(address(0)));
  }

  /**
   * @notice Creates a new company including a multisig wallet and ERC20 token (no brokerbot).
   * @param tokenConfig The configuration for the ERC20 token.
   * @param multisig The address of the existing multisig wallet.
   */
  function createCompanyWithoutBrokerbotExistingMultisig(TokenConfig calldata tokenConfig, address multisig, string calldata salt) public {
    IERC20Permit token = tokenFactory.createToken(tokenConfig, multisig, salt);
    emit CompanyCreated(multisig, token, Brokerbot(address(0)));
  }

  /**
   * @notice Creates a multisig wallet.
   * @param signer The address of the signer for the multisig wallet.
   * @param salt A unique salt used to create the multisig wallet.
   * @return The address of the created multisig wallet.
   */
  function createMultisig(address signer, string calldata symbol, string calldata salt) public returns (address) {
    return address(manager.multisigFactory().create(signer, keccak256(abi.encodePacked(symbol,salt))));
  }

  /**
   * @notice Updates the FactoryManager.
   * @param _manager The new FactoryManager.
   */
  function setManager(FactoryManager _manager) external onlyOwner() {
    manager = _manager;
    emit FactoryManagerUpdated(manager);
  }

  /**
   * @notice Updates the BrokerbotFactory.
   * @param _factory The new BrokerbotFactory.
   */
  function setBrokerbotFactory(BrokerbotFactory _factory) external onlyOwner() {
    brokerbotFactory = _factory;
    emit BrokerbotFactoryUpdated(brokerbotFactory);
  }

  /**
   * @notice Updates the TokenFactory.
   * @param _factory The new TokenFactory.
   */
  function setTokenFactory(TokenFactory _factory) external onlyOwner() {
    tokenFactory = _factory;
    emit TokenFactoryUpdated(tokenFactory);
  }

}
