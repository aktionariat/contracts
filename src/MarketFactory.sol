
/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity >=0.8;

import "./Market.sol";

contract MarketFactory {

  event ContractDeployed(address contractAddress);
    
  function create(bytes32 salt, address baseCurrency, address shareToken, address owner) public returns (address) {
    Market market = new Market{salt: salt}();
    market.initialize(baseCurrency, shareToken);
    emit ContractDeployed(address(market));
    market.transferOwnership(owner);
    return address(market);
  }
}