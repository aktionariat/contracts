// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

import "./lib/BytecodeStore.sol";
import {LockReleaseTokenPool} from "@chainlink/contracts-ccip/contracts/pools/LockReleaseTokenPool.sol";

/// @dev Creation code of Chainlink's LockReleaseTokenPool 2.0.0 from the pinned package, deployed on the home chain.
contract LockReleaseTokenPoolFactory is BytecodeStore {

    function creationCode() external pure override returns (bytes memory) {
        return type(LockReleaseTokenPool).creationCode;
    }

    // Any new Chainlink pool release gets a new number here; it is part of the pool's salt.
    function version() external pure override returns (uint256) {
        return 2;
    }
}
