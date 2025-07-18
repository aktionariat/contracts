import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SmartAccountModule = buildModule("SmartAccountModule", (m) => {
  const backendOwner = m.getAccount(0);

  const smartAccount = m.contract("SmartAccount", [], { from: backendOwner });

  return { 
    smartAccount
   };
});

export default SmartAccountModule;
