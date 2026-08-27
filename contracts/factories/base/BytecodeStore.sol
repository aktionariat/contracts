// SPDX-License-Identifier: LicenseRef-Aktionariat
pragma solidity ^0.8.26;

abstract contract BytecodeStore {
    bytes public bytecode;

    error EmptyBytecode();

    constructor() {
        bytes memory targetBytecode = _targetBytecode();
        if (targetBytecode.length == 0) revert EmptyBytecode();
        bytecode = targetBytecode;
    }

    /**
     * @notice Creation bytecode of the contract this factory deploys.
     * @dev    Concrete factories import their target contract and return
     *         `type(Target).creationCode`.
     */
    function _targetBytecode() internal view virtual returns (bytes memory);
}