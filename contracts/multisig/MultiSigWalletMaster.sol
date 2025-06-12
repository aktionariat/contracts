/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.30;

import "../utils/Initializable.sol";
import "./MultichainWallet.sol";

contract MultiSigWalletMaster is MultichainWallet, Initializable {

  // Deployed on 0xF71dEc9eA8892871cbEA369Dc41E39773e13b925, made from 0xE8dA532e9367AF57A9e46557E458c96378cB83EC (a Metamask address from Luzius)

  // args must be the same address across all chains and only be used to initiate immutables, address used for deployment was 0xf6d96dD440D020022134b8d902bedC2a2249E041
  constructor(IArgumentSource args) MultichainWallet(args){
  }

  function initialize(address owner) external initializer {
    _setSigner(owner, 1); // set initial owner
  }

}