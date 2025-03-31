import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const eggfsAddress = "0x620BF52Fa5E97fbFb3992cab478e3272285ADfD1";
const eggsAddress = "0x1f6Db77Bf48CB29F30b84eA2AE9ffD4b07C4571e"

const FarmyCancelledModule = buildModule("FarmyCancelledModule", (m) => {
  const eggfs20Cancelled = m.contract("ERC20Cancelled", [eggfsAddress], { id: "EGGFS20Cancelled" });
  const eggs20Cancelled = m.contract("ERC20Cancelled", [eggsAddress], { id: "EGGS20Cancelled" });

  return { 
    eggfs20Cancelled,
    eggs20Cancelled
   };
});

export default FarmyCancelledModule;
