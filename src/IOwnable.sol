// SPDX-License-Identifier: MIT
pragma solidity >=0.8;

interface IOwnable {

    function owner() external returns (address);

    modifier onlyOwner() {
        require(this.owner() == msg.sender, "not owner");
        _;
    }

}