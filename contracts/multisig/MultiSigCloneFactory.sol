
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/proxy/Clones.sol";

// Deployed at 0x3cb73399cE9D7300f284a2F4Ad4bcEd6F64B89E6
contract MultiSigCloneFactory {

  address constant public IMPLEMENTATION = address(0xF71dEc9eA8892871cbEA369Dc41E39773e13b925);

  event ContractCreated(address indexed contractAddress, string indexed typeName, bytes32 salt);

  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(IMPLEMENTATION, salt);
  }

  function create(address owner, bytes32 salt) external returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(IMPLEMENTATION, salt));
    IMultisig(instance).initialize(block.chainid == 1 ? owner : address(0x0));
    emit ContractCreated(instance, "MultiSigWallet", salt);
    return instance;
  }
}

interface IMultisig {
  function initialize(address owner) external;
}