// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Given that development on ERC 677 has stalled, we should consider supporting EIP 1363: https://eips.ethereum.org/EIPS/eip-1363
interface IERC677 {
   function transferAndCall(address to, uint value, bytes calldata data) external returns (bool success);
}