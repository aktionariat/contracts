pragma solidity ^0.8.0;

contract Forwarder {

    function fallback(address payable target) public payable {
        (bool sent, bytes memory data) = target.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
    }

}