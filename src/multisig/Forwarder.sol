pragma solidity ^0.8.0;

contract Forwarder {

    function(address payable target) public payable {
        (bool sent, bytes memory data) = _to.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
    }

}