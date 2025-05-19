/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.29;

import "../utils/Initializable.sol";
import "./MultiSigWallet.sol";

contract MultiSigWalletNewMaster is MultiSigWallet, Initializable {

  function initialize(address owner) external initializer {
    _setSigner(owner, 1); // set initial owner
  }

}