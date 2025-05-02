import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const siasAddress = "0x5Ad323D764301E057614eDb0449f470d68EA9485"

const SIASCancelledModule = buildModule("SIASCancelledModule", (m) => {
  const siasCancelled = m.contract("ERC20Cancelled", [siasAddress], { id: "SIASCancelled" });

  return { 
    siasCancelled
   };
});

export default SIASCancelledModule;
