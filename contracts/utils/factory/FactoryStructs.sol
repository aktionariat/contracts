// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "../../ERC20/IERC20.sol";

struct TokenConfig{
  string name;
  string symbol;
  string terms;
  bool draggable;
  uint256 quorumDrag;
  uint256 quorumMigration;
  uint256 votePeriod;
}

struct BrokerbotConfig {
  uint256 price;
  uint256 increment;
  IERC20 baseCurrency;
}