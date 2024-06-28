// SPDX-License-Identifier: MIT


pragma solidity ^0.8.0;


import { Ownable } from "../Ownable.sol";
import { IOfferFactory } from "../../draggable/IOfferFactory.sol";
import { PaymentHub } from "../../brokerbot/PaymentHub.sol";
import { Brokerbot } from "../../brokerbot/Brokerbot.sol";
import { RecoveryHub } from "../../recovery/RecoveryHub.sol";
import { MultiSigCloneFactory } from "../../multisig/MultiSigCloneFactory.sol";
import { IERC20Permit } from "../../ERC20/IERC20Permit.sol";
import { IERC20 } from "../../ERC20/IERC20.sol";
import { BrokerbotRegistry } from "../../brokerbot/BrokerbotRegistry.sol";
import { AllowlistShares } from "../../shares/AllowlistShares.sol";
import { AllowlistDraggableShares } from "../../shares/AllowlistDraggableShares.sol";
import { Shares } from "../../shares/Shares.sol";
import { DraggableShares } from "../../shares/DraggableShares.sol";
import { Permit2Hub } from "../Permit2Hub.sol";
import { DraggableParams } from "../../draggable/ERC20Draggable.sol";

/**
 * @title Factory to deploy shares contracts and brokerbot
 * @author rube
 * 
 */
contract FactoryManager is Ownable {

  IOfferFactory public offerFactory;
  MultiSigCloneFactory public multisigFactory;
  PaymentHub public paymentHub;
  RecoveryHub public recoveryHub;
  BrokerbotRegistry public registry;
  Permit2Hub public permit2Hub;

  event PaymentHubUpdated(PaymentHub indexed paymentHub);
  event OfferFactoryUpdated(IOfferFactory indexed offerFactory);
  event RecoveryHubUpdated(RecoveryHub indexed recoveryHub);
  event Permit2HubUpdated(Permit2Hub indexed permit2Hub);
  event BrokerbotRegistryUpdated(BrokerbotRegistry indexed BrokerbotRegistry);
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

  function setBrokerbotRegistry(BrokerbotRegistry _brokerbotRegistry) external onlyOwner() {
    registry = _brokerbotRegistry;
    emit BrokerbotRegistryUpdated(registry);
  }
}