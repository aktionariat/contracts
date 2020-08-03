// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

// For Test Suite
contract ForceSend {
    function send(address payable victim) external payable {
        selfdestruct(victim);
    }
}