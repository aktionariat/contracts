
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8;

import "./MarketMaker.sol";

contract MarketMakerFactory {

  event ContractDeployed(address contractAddress);
    
  function create(bytes32 salt, address baseCurrency, address shareToken, address owner) public returns (address) {
    MarketMaker marketMaker = new MarketMaker{salt: salt}();
    marketMaker.initialize(baseCurrency, shareToken);
    emit ContractDeployed(address(marketMaker));
    marketMaker.transferOwnership(owner);
    return address(marketMaker);
  }
}