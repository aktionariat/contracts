import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PHTOS_Address = "0x416076a1957b1b3b180269e10f64f9DFcE492551";
const ZCHF_Address = "0xD4dD9e2F021BB459D5A5f6c24C12fE09c5D45553";
const price = 7100000000000000000n;
const increment = 0n;
const owner = "0x161dffc7005ef03b2e8c5fd390a6f5eccc0f5f96";
const paymentHubAddress = "0x3EeffEbd88a3b4BC1FE600BFcD1c0A8C8b813980";

const PHTOSBrokerbotModule260116 = buildModule("PHTOSBrokerbotModule260116", (m) => {
  const backendOwner = m.getAccount(0);
  
  const brokerbot = m.contract("Brokerbot", [PHTOS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default PHTOSBrokerbotModule260116;
