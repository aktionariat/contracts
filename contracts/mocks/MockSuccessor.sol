// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ISuccessorToken} from "../shares/base/Shares.sol";

/// @notice Mock successor token implementing ISuccessorToken (notifyBurned) and ISuccessor (wrap).
contract MockSuccessor is ERC20, ISuccessorToken {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Called by Shares.migrate() — mints tokens to the beneficiary.
    function notifyBurned(address beneficiary, uint256 amount) external {
        if (beneficiary == address(0) && amount == 0) {
            // test interface call
            return;
        }

        _mint(beneficiary, amount);
    }

    /// @notice Called by SHA.executeMigration() (TYPE_DEFAULT) — mints tokens to the caller.
    function wrap(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
