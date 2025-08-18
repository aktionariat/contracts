// Adds multichain deployment argument source 
// Uses previous token, shares and brokerbot factories
// Do not use unmodified between chains. Argument source must be initialized with the correct CCIP address based on the chain being deployed to.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CCIPRouterAddress = {
  "mainnet": "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
  "optimism": "0x3206695CaE29952f4b0c22a169725a865bc8Ce0f",
  "polygon": "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe"
}

const MultichainWalletRolloutModule0725 = buildModule("MultichainWalletRolloutModule0725", (m) => {
  const backendOwner = m.getAccount(0);

  // Deploy argument source and initialize it
  const rollout = m.contract("Rollout", [], { from: backendOwner });
  m.call(rollout, "rollout", [CCIPRouterAddress.mainnet], { from: backendOwner });

  return { 
    rollout
   };
});

export default MultichainWalletRolloutModule0725;
