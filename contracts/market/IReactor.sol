// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Intent} from "./IntentHash.sol";

interface IReactor {

    function calculateHash(Intent calldata intent) external view returns (bytes32);
    function verify(Intent calldata intent, bytes calldata sig) external view;
    function signalIntent(Intent calldata intent, bytes calldata signature) external;
    function process(address feeRecipient, Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig) external;

}