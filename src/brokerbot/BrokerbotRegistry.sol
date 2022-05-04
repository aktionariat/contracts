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

import "../utils/Ownable.sol";

contract BrokerbotRegistry is Ownable {

  mapping(address => mapping(address => address)) public getBrokerbot;
  constructor(address _owner) Ownable(_owner) {}

  function addBrokerbot(address ) external onlyOwner() {

  }

  function removeBrokerbot() external onlyOwner() {

  }

}