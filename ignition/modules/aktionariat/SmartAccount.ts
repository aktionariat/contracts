import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AktionariatSmartAccountModule = buildModule("AktionariatSmartAccountModule", (m) => {
  const backendOwner = m.getAccount(0);

  const smartAccount = m.contract("AktionariatSmartAccount", [], { from: backendOwner });

  return { 
    smartAccount
   };
});

export default AktionariatSmartAccountModule;
