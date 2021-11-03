// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC20Named.sol";

contract ERC20Basic is ERC20Named {

    constructor(address _admin, string memory _name , string memory _symbol, uint8 _decimals) ERC20Named(_admin, _name, _symbol, _decimals) {
    }

    function mint(address target, uint256 amount) public onlyOwner {
        _mint(target, amount);
    }

}