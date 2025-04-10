import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// This module deploys the MultisigWalletMaster V6, 
// the MultisigCloneFactory using it and updates the 
// FactoryManager to use the new factory.
// It needs to be run on different chains separately

const config = {
  factoryManagerAddressMultichain: "0x555E7852d4ab6F8C557F9Bc6d17ADdb8c7911d78",
  factoryManagerOwnerAddress: "0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE",
  aktionariatFactoryAddressMultichain: "0x5D07D23567DD022FA7105BEE9D1d1352c0CA82B3"
}

const MultisigUpdateV6Module = buildModule("MultisigUpdateV6Module", (m) => {
  const factoryDeployer = m.getAccount(4);
  const multiSigWalletMasterV6 = m.contract("MultiSigWalletMaster", [], { from: factoryDeployer});
  const multisigCloneFactory = m.contract("MultiSigCloneFactory", [multiSigWalletMasterV6], { from: factoryDeployer });
  const factoryManager = m.contractAt("FactoryManager", config.factoryManagerAddressMultichain);
  const aktionariatFactory = m.contractAt("AktionariatFactory", config.aktionariatFactoryAddressMultichain);

  return { 
    multiSigWalletMasterV6,
    multisigCloneFactory,
    factoryManager,
    aktionariatFactory
   };
});

export default MultisigUpdateV6Module;
