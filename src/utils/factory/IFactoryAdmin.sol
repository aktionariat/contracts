// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


import { IOfferFactory } from "../../draggable/IOfferFactory.sol";
import { MultiSigCloneFactory } from "../../multisig/MultiSigCloneFactory.sol";
import { PaymentHub } from "../../brokerbot/PaymentHub.sol";

interface IFactoryAdmin {

  function offerFactory() external returns (IOfferFactory);

  function multisigFactory() external returns (MultiSigCloneFactory);
  
  function paymentHub() external returns (PaymentHub);
  
}
