/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* Proprietary License
*
* This code cannot be used without an explicit permission from the copyright holder.
* If you wish to use the Aktionariat Brokerbot, you can either use the open version
* named Brokerbot.sol that can be used under an MIT License with Automated License Fee Payments,
* or you can get in touch with use to negotiate a license to use LicensedBrokerbot.sol .
*
* Copyright (c) 2021 Aktionariat AG (aktionariat.com), All rights reserved.
*/
pragma solidity ^0.8.0;

import "./IBrokerbot.sol";
import "../ERC20/IERC20.sol";
import "../utils/Ownable.sol";

contract BrokerbotRegistry is Ownable {

  mapping(IERC20 => mapping(IERC20 => IBrokerbot)) public getBrokerbot;

  event RegisterBrokerbot(IBrokerbot brokerbot, IERC20 base, IERC20 token);
  event SyncBrokerbot(IBrokerbot indexed brokerbot);
  constructor(address _owner) Ownable(_owner) {}

  function registerBrokerbot(IBrokerbot _brokerbot, IERC20 _base, IERC20 _token ) external onlyOwner() {
    getBrokerbot[_base][_token] = _brokerbot;
    emit RegisterBrokerbot(_brokerbot, _base, _token);
  }

  function syncBrokerbot(IBrokerbot brokerbot) external {
    emit SyncBrokerbot(brokerbot);
  }

}