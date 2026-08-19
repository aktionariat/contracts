// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./ERC20Flaggable.sol";
import "../utils/Ownable.sol";

abstract contract ERC20Named is Initializable, ERC20Flaggable, Ownable {
    string public name;
    string public symbol;

    event NameChanged(string name, string symbol);

    constructor(string memory _symbol, string memory _name, uint8 _decimals, address _admin) ERC20Flaggable(_decimals) Ownable(_admin) {
        _setName(_symbol, _name);
    }

    /**
     * Proxy construtor.
     */
    function __ERC20Named_init(string memory _symbol, string memory _name, uint8 _decimals, address _admin) internal onlyInitializing {
        __ERC20Flaggable_init(_decimals);
        __Ownable_init(_admin);

        _setName(_symbol, _name);
    }

    /**
     * Sets both the name and symbol of the token
     * 
     * @dev Only owner can call
     */
    function setName(string memory _symbol, string memory _name) external onlyOwner {
        _setName(_symbol, _name);
    }

    /**
     * Internal name and symbol setter.
     * 
     * @dev Emits `NameChanged`
     */
    function _setName(string memory _symbol, string memory _name) internal {
        symbol = _symbol;
        name = _name;
        emit NameChanged(_name, _symbol);
    }
}
