// SPDX-License-Identifier: LicenseRef-Aktionariat
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

abstract contract OwnableBytecodeStore is Ownable {
    bytes public bytecode;
    bytes32 public bytecodeHash;

    event BytecodeUpdated(bytes32 indexed newHash);

    error EmptyBytecode();

    constructor(bytes memory initialBytecode) Ownable(msg.sender) {
        _setBytecode(initialBytecode);
    }

    function setBytecode(bytes calldata newBytecode) external onlyOwner {
        _setBytecode(newBytecode);
        emit BytecodeUpdated(bytecodeHash);
    }

    function _setBytecode(bytes memory newBytecode) internal {
        if (newBytecode.length == 0) revert EmptyBytecode();
        bytecode = newBytecode;
        bytecodeHash = keccak256(newBytecode);
    }
}
