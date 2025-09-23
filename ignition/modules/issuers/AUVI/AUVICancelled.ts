import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AUVISAddress = "0xa4fb4335d8a3a2cc74877ecb2e52eb45e8425779"

const AUVICancelledModule = buildModule("AUVICancelledModule", (m) => {
  const AUVISCancelled = m.contract("ERC20Cancelled", [AUVISAddress], { id: "AUVISCancelled" });

  return { 
    AUVISCancelled
   };
});

export default AUVICancelledModule;
