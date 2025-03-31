// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import { IOfferFactory } from "../../draggable/IOfferFactory.sol";
import { MultiSigCloneFactory } from "../../multisig/MultiSigCloneFactory.sol";
import { Ownable } from "../Ownable.sol";
import { PaymentHub } from "../../brokerbot/PaymentHub.sol";
import { Permit2Hub } from "../Permit2Hub.sol";
import { RecoveryHub } from "../../recovery/RecoveryHub.sol";

/**
 * @title Factory Mangager for common contracts
 * @author rube
 * 
 */
contract FactoryManager is Ownable {

  IOfferFactory public offerFactory;
  MultiSigCloneFactory public multisigFactory;
  PaymentHub public paymentHub;
  RecoveryHub public recoveryHub;
  Permit2Hub public permit2Hub;

  event PaymentHubUpdated(PaymentHub indexed paymentHub);
  event OfferFactoryUpdated(IOfferFactory indexed offerFactory);
  event RecoveryHubUpdated(RecoveryHub indexed recoveryHub);
  event Permit2HubUpdated(Permit2Hub indexed permit2Hub);
  event MultiSigCloneFactoryUpdated(MultiSigCloneFactory indexed MultiSigCloneFactory);

  constructor(address _owner) Ownable(_owner) {}


  function setPaymentHub(PaymentHub _paymentHub) external onlyOwner() {
    paymentHub = _paymentHub;
    emit PaymentHubUpdated(paymentHub);
  }

  function setOfferFactory(IOfferFactory _offerFactory) external onlyOwner() {
    offerFactory = _offerFactory;
    emit OfferFactoryUpdated(offerFactory);
  }

  function setRecoveryHub(RecoveryHub _recoveryHub) external onlyOwner() {
    recoveryHub = _recoveryHub;
    emit RecoveryHubUpdated(recoveryHub);
  }
  
  function setMultiSigCloneFactory(MultiSigCloneFactory _multsigFactory) external onlyOwner() {
    multisigFactory = _multsigFactory;
    emit MultiSigCloneFactoryUpdated(multisigFactory);
  }

  function setPermit2Hub(Permit2Hub _permit2Hub) external onlyOwner() {
    permit2Hub = _permit2Hub;
    emit Permit2HubUpdated(permit2Hub);
  }
}