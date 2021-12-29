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

import "./Brokerbot.sol";

contract LicensedBrokerbot is Brokerbot {

    constructor(
        address _shareToken,
        uint256 _price,
        uint256 _increment,
        address _baseCurrency,
        address _owner,
        address _paymentHub
    ) Brokerbot (_shareToken, _price, _increment, _baseCurrency, _owner, _paymentHub) {}

    function getLicenseFee(uint256) public pure override returns (uint256) {
        return 0;
    }
}