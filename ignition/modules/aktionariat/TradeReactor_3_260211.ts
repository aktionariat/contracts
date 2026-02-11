import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TradeReactor_3_260211Module = buildModule("TradeReactor_3_260211Module", (m) => {
  const tradeReactor = m.contract("TradeReactor", []);

  return { 
    tradeReactor
   };
});

export default TradeReactor_3_260211Module;
