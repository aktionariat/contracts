// SPDX-License-Identifier: MIT


pragma solidity ^0.8.0;

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
 * @author rube
 * 
 */
contract AktionariatFactory is Ownable {

  BrokerbotFactory public brokerbotFactory;
  TokenFactory public tokenFactory;
  FactoryManager public manager;

  event CompanyCreated(address indexed multisig, IERC20Permit indexed token, Brokerbot indexed brokerbot);
  event FactoryManagerUpdated(FactoryManager manager);
  event TokenFactoryUpdated(TokenFactory tokenFactory);
  event BrokerbotFactoryUpdated(BrokerbotFactory brokerbotFactory);

  constructor(address _owner) Ownable(_owner){}

  function createCompany(TokenConfig memory tokenConfig, BrokerbotConfig memory brokerbotConfig, address signer) public {
    address multisig = createMultisig(signer, tokenConfig.symbol);
    IERC20Permit token = tokenFactory.createToken(tokenConfig, multisig);
    Brokerbot brokerbot = brokerbotFactory.createBrokerbot(brokerbotConfig, token, multisig);
    emit CompanyCreated(multisig, token, brokerbot);
  }

  function createMultisig(address signer, string memory salt) public returns (address) {
    return address(manager.multisigFactory().create(signer, keccak256(abi.encodePacked(salt))));
  }

  function setManager(FactoryManager _manager) external onlyOwner() {
    manager = _manager;
    emit FactoryManagerUpdated(manager);
  }

  function setBrokerbotFactory(BrokerbotFactory _factory) external onlyOwner() {
    brokerbotFactory = _factory;
    emit BrokerbotFactoryUpdated(brokerbotFactory);
  }

  function setTokenFactory(TokenFactory _factory) external onlyOwner() {
    tokenFactory = _factory;
    emit TokenFactoryUpdated(tokenFactory);
  }

}