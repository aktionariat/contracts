// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {MockERC20} from "./MockERC20.sol";

/// @notice Minimal WETH9 mock for testing PaymentHub ETH flows.
contract MockWETH9 is MockERC20 {
    constructor() MockERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }
}
