// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Intent} from "./IntentHash.sol";

interface IReactor {

    function verify(Intent calldata intent, bytes calldata sig) external view;
    function signalIntent(Intent calldata intent, bytes calldata signature) external;
    function getFilledAmount(Intent calldata intent) external view returns (uint160);
    function getMaxValidAmount(Intent calldata sellerIntent, Intent calldata buyerIntent, uint16 minSpread) external view returns (uint256);
    function getTotalExecutionPrice(Intent calldata buyerIntent, Intent calldata sellerIntent, uint256 tradedTokens) external pure returns (uint256);
    function process(Intent calldata sellerIntent, bytes calldata sellerSig, Intent calldata buyerIntent, bytes calldata buyerSig, uint256 tradedTokens, uint256 totalFee) external;

}