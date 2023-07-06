 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Forwarder {

    error Forwarder_EtherTransferFailed();

    function fallback(address payable target) public payable {
        (bool sent, bytes memory data) = target.call{value: msg.value}("");
        if (!sent) {
            revert Forwarder_EtherTransferFailed();
        }
    }

}