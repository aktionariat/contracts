// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// For Test Suite
contract ForceSend {
    function send(address payable victim) external payable {
        selfdestruct(victim);
    }
}