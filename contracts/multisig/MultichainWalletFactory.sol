
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.30;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultichainWalletFactory {

  address constant public IMPLEMENTATION = address(0xf180206B2b17aa104366A8D43D7966C25F25d82a);

  mapping(uint256 => ChainConfig) private chainConfig;

  event ContractCreated(address indexed contractAddress, string indexed typeName, bytes32 salt);
  
  constructor() {
      // Default chain configurations.
      chainConfig[1] = ChainConfig(0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D, 0x514910771AF9Ca656af840dff83E8264EcF986CA);   // Ethereum Mainnet
      chainConfig[10] = ChainConfig(0x3206695CaE29952f4b0c22a169725a865bc8Ce0f, 0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6);  // Optimism
      chainConfig[137] = ChainConfig(0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe, 0xb0897686c545045aFc77CF20eC7A532E3120E0F1); // Polygon
  }

  function predict(bytes32 salt) external view returns (address) {
    return Clones.predictDeterministicAddress(IMPLEMENTATION, salt);
  }

  function create(address owner, bytes32 salt) external returns (address) {
    address payable instance = payable(Clones.cloneDeterministic(IMPLEMENTATION, salt));
    IMultichainWallet(instance).initialize(block.chainid == 1 ? owner : address(0x0));
    emit ContractCreated(instance, "MultiSigWallet", salt);
    return instance;
  }

  struct ChainConfig {
    address router;
    address link;
  }

  function getRouterAddress() external view returns (address) {
    return chainConfig[block.chainid].router;
  }

  function getLinkAddress() external view returns (address) {
    return chainConfig[block.chainid].link;
  }
}

interface IMultichainWallet {
  function initialize(address owner) external;
}