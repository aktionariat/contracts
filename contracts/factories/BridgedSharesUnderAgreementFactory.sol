// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2020-2026 Aktionariat AG (aktionariat.com)

pragma solidity 0.8.37;

import "./lib/BytecodeStore.sol";
import "../shares/sha/BridgedSharesUnderAgreement.sol";

/// @dev Creation code of BridgedSharesUnderAgreement, deployed by AktionariatFactory on the other chains.
contract BridgedSharesUnderAgreementFactory is BytecodeStore {

    function creationCode() external pure override returns (bytes memory) {
        return type(BridgedSharesUnderAgreement).creationCode;
    }

    // Must equal the VERSION of the deployed contract (Solidity cannot read it from the type); the tests check it.
    function version() external pure override returns (uint256) {
        return 6;
    }
}
