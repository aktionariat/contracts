// Adds multichain deployment argument source 
// Uses previous token, shares and brokerbot factories
// Do not use unmodified between chains. Argument source must be initialized with the correct CCIP address based on the chain being deployed to.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const config = {
  factoryManager: "0x555E7852d4ab6F8C557F9Bc6d17ADdb8c7911d78",
}

const MultiSigCloneFactoryUpdate0725Module = buildModule("MultiSigCloneFactoryUpdate0725Module", (m) => {
  const backendOwner = m.getAccount(0);

  // Deploy multisig clone factory with the implementation hardcoded in the contract
  const multisigCloneFactory = m.contract("MultiSigCloneFactory", [], { from: backendOwner });

  // Update the existing aktionariat factory to use the new multisig clone factory
  const factoryManager = m.contractAt("FactoryManager", config.factoryManager);
  m.call(factoryManager, "setMultiSigCloneFactory", [multisigCloneFactory], { from: backendOwner });

  return { 
    multisigCloneFactory,
    factoryManager
   };
});

export default MultiSigCloneFactoryUpdate0725Module;
