import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TVPLSAddress = "0x8fb94e08bc984497aaaf1a545ed455be89f8c675"

const TVPLCancelledModule = buildModule("TVPLCancelledModule", (m) => {
  const TVPLSCancelled = m.contract("ERC20Cancelled", [TVPLSAddress], { id: "TVPLSCancelled" });

  return { 
    TVPLSCancelled
   };
});

export default TVPLCancelledModule;
