// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITransferHook {

    function beforeTokenTransfer(address from, address to, uint256 amount) external;

}
