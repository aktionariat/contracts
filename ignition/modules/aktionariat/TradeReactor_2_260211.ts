import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TradeReactor260211Module = buildModule("TradeReactor260211Module", (m) => {
  const tradeReactor = m.contract("TradeReactor", []);

  return { 
    tradeReactor
   };
});

export default TradeReactor260211Module;
