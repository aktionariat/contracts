// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {IRMN} from "@chainlink/contracts-ccip/contracts/interfaces/IRMN.sol";

contract MockRMN is IRMN {
    function isBlessed(IRMN.TaggedRoot calldata) external pure override returns (bool) {
        return false;
    }

    function isCursed() external pure override returns (bool) {
        return false;
    }

    function isCursed(bytes16) external pure override returns (bool) {
        return false;
    }
}
