// SPDX-License-Identifier: MIT

pragma solidity >=0.8;

import "./ERC20.sol";

contract ERC20Basic is ERC20 {

    string public override name;
    string public override symbol;

    address owner;

    constructor(string memory name_ , string memory symbol_, uint8 decimals) ERC20(decimals){
        name = name_;
        symbol = symbol_;
        owner = msg.sender;
    }

    function mint(address target, uint256 amount) public {
        require(msg.sender == owner);
        super._mint(target, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) override internal{
    }

    function setRecoverable(bool) public pure {
    }

}