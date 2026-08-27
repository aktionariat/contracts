// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFeeToken is ERC20 {
    constructor() ERC20("Mock Fee Token", "MFEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
