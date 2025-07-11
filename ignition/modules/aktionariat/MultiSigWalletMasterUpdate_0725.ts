// Adds multichain deployment argument source 
// Uses previous token, shares and brokerbot factories
// Do not use unmodified between chains. Argument source must be initialized with the correct CCIP address based on the chain being deployed to.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CCIPRouterAddress = {
  "mainnet": "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
  "optimism": "0x3206695CaE29952f4b0c22a169725a865bc8Ce0f",
  "polygon": "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe"
}

const MultiSigWalletMasterUpdateModule0725 = buildModule("MultiSigWalletMasterUpdateModule0725", (m) => {
  const backendOwner = m.getAccount(0);

  // Deploy argument source and initialize it
  const argumentSource = m.contract("MultchainWalletArgumentSource", [], { from: backendOwner });
  m.call(argumentSource, "initialize", [CCIPRouterAddress.mainnet], { from: backendOwner });

  // Deploy the MultiSigWalletMaster using the argument source and initialize it
  const multiSigWalletMaster = m.contract("MultiSigWalletMaster", [argumentSource], { from: backendOwner });
  m.call(multiSigWalletMaster, "initialize", [backendOwner], { from: backendOwner });

  return { 
    argumentSource,
    multiSigWalletMaster
   };
});

export default MultiSigWalletMasterUpdateModule0725;
