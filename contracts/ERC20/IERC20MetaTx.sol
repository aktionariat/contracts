/**
* SPDX-License-Identifier: MIT
*
* Copyright (c) 2016-2019 zOS Global Limited
*
*/
pragma solidity 0.8.29;

import "./IERC20.sol";
/**
 * @dev Interface for the ChildERC20 of Polygon
 */
interface IERC20MetaTx is IERC20 {
  struct MetaTransaction {
        uint256 nonce;
        address from;
        bytes functionSignature;
    }

  function executeMetaTransaction(address userAddress, bytes calldata functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) external payable returns (bytes memory);

  function getNonce(address user) external view returns (uint256 nonce);

  function getChainId() external pure returns (uint256);
}