// SPDX-License-Identifier: MIT

pragma solidity >=0.8;

import "./ERC20.sol";
import "./Ownable.sol";

contract ERC20Named is ERC20, Ownable {

    string public override name;
    string public override symbol;

    constructor(address admin, string memory name_ , string memory symbol_, uint8 decimals) ERC20(decimals) Ownable(admin) {
        name = name_;
        symbol = symbol_;
    }

    function setName(string memory _symbol, string memory _name) public onlyOwner {
        symbol = _symbol;
        name = _name;
    }

}