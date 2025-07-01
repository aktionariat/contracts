
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultiSigCloneFactory {

  address constant public IMPLEMENTATION = address(0xf180206B2b17aa104366A8D43D7966C25F25d82a);

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