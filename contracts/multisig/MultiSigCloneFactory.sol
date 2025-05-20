
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.30;

import "./MultiSigWalletMaster.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultiSigCloneFactory {

  address immutable public multiSigImplementation;

  event ContractCreated(address indexed contractAddress, string indexed typeName);

  constructor(address _multiSigImplementation) {
    multiSigImplementation = _multiSigImplementation;
  }
  
  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(multiSigImplementation, salt);
  }

  function create(address owner, bytes32 salt) external returns (MultiSigWalletMaster) {
    address payable instance = payable(Clones.cloneDeterministic(multiSigImplementation, salt));
    MultiSigWalletMaster(instance).initialize(owner);
    emit ContractCreated(instance, "MultiSigWallet");
    return MultiSigWalletMaster(instance);
  }
}