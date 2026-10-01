// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

import "./Ownable.sol";

// abstract because it does not initiate Ownable
abstract contract DeterrenceFee is Ownable {

    uint96 public deterrenceFee;

    event DeterrenceFeePaid(address payer, uint256 fee);

    error FeeMissing(uint256 required, uint256 found);
    error UnableToPayDeterrenceFee(address receiver);

    constructor(uint96 deterrenceFee_){
        deterrenceFee = deterrenceFee_;
    }

    modifier deter(uint16 multiple) {
        // Non-owners must pay the fee; whatever is sent goes to the owner in full
        if (msg.sender != owner) {
            uint256 fee = deterrenceFee * multiple;
            if (msg.value < fee) revert FeeMissing(fee, msg.value);
        }
        if (msg.value > 0) {
            // Intentionally sends the entire msg.value instead of exact fee to avoid ETH stuck on contract
            (bool success, ) = payable(owner).call{value: msg.value}("");
            if (!success) revert UnableToPayDeterrenceFee(owner);
            emit DeterrenceFeePaid(msg.sender, msg.value);
        }
        _;
    }

    function setDeterrenceFee(uint96 fee) external onlyOwner {
        deterrenceFee = fee;
    }

}