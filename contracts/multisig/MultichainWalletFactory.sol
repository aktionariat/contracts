/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./MultichainWalletMaster.sol";

contract MultichainWalletFactory {

  MultichainWalletMaster immutable public IMPLEMENTATION;

  event ContractCreated(address indexed contractAddress, string indexed typeName, bytes32 salt);

  constructor(MultichainWalletMaster master){
    IMPLEMENTATION = master;
  }

  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(address(IMPLEMENTATION), salt);
  }

  function create(address owner, bytes32 salt) external returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(address(IMPLEMENTATION), salt));
    MultichainWalletMaster(instance).initialize(block.chainid == 1 ? owner : address(0x0));
    emit ContractCreated(instance, "MultichainWallet", salt);
    return instance;
  }

  function createWithSigners(address[] calldata signers, uint8[] calldata powers, bytes32 salt) external returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(address(IMPLEMENTATION), salt));
    if (block.chainid == 1) {
      MultichainWalletMaster(instance).initializeWithSigners(signers, powers);
    } else {
      MultichainWalletMaster(instance).initialize(address(0x0));
    }
    emit ContractCreated(instance, "MultichainWallet", salt);
    return instance;
  }
}
