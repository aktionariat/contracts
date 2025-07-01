/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.30;

import "../utils/Initializable.sol";
import "./MultichainWallet.sol";

contract MultiSigWalletMaster is MultichainWallet, Initializable {

  // args must be the same address across all chains and only be used to initiate immutables, address used for deployment was 0xf6d96dD440D020022134b8d902bedC2a2249E041
  constructor(IArgumentSource args) MultichainWallet(args){
  }

  function initialize(address owner) external initializer {
    _setSigner(owner, 1); // set initial owner
  }

}