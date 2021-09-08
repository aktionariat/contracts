// SPDX-License-Identifier: MIT

pragma solidity >=0.8;

import "./ERC20Named.sol";

contract ERC20Basic is ERC20Named {

    constructor(address admin, string memory name_ , string memory symbol_, uint8 decimals) ERC20Named(admin, name_, symbol_, decimals) {
    }

    function mint(address target, uint256 amount) public onlyOwner {
        _mint(target, amount);
    }

}