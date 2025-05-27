// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./ERC20Flaggable.sol";
import "../utils/Permit2Hub.sol";

/// @title ERC20Permit2
/// @dev This abstract contract extends the ERC20Flaggable contract and introduces the Permit2Hub.
abstract contract ERC20Permit2 is ERC20Flaggable {
    
    /// @dev The Permit2Hub contract instance.
    Permit2Hub public immutable permit2Hub;

    /// @dev Initializes the ERC20Permit2 contract.
    /// @param _permit2Hub The address of the Permit2Hub contract.
    constructor(Permit2Hub _permit2Hub) {
        permit2Hub = _permit2Hub;
    }

    /// @inheritdoc ERC20Flaggable
    function allowance(address owner, address spender) public view virtual override(ERC20Flaggable) returns (uint256) {
        if (permit2Hub.isPermit2Enabled(owner, spender)) 
            return type(uint256).max;  // If permit is enabled, return the maximum value of uint256
        else 
            return super.allowance(owner, spender);  // Otherwise, call the parent(ERC20Flaggable) allowance function
    }
}
