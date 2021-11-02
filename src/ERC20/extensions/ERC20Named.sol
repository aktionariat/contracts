// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC20Flaggable.sol";
import "../../utils/Ownable.sol";

contract ERC20Named is ERC20Flaggable, Ownable {

    string public override name;
    string public override symbol;

    constructor(address admin, string memory name_ , string memory symbol_, uint8 decimals) ERC20Flaggable(decimals) Ownable(admin) {
        setNameInternal(name_, symbol_);
    }

    function setName(string memory _symbol, string memory _name) public onlyOwner {
        setNameInternal(_symbol, _name);
    }

    function setNameInternal(string memory _symbol, string memory _name) internal {
        symbol = _symbol;
        name = _name;
        emit NameChanged(_name, _symbol);
    }

}