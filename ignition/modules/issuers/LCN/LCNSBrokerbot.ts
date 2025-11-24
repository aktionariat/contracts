import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LCNS_Address = "0x30db17899C247193e2943da3B640DF1af8Ff26f4";
const ZCHF_Address = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const price = 1000000000000000n;
const increment = 0n;
const owner = "0x3a3c22eee11bcc8877a81739e2fc42809587e7c5";
const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";

const LCNSBrokerbotModule = buildModule("LCNSBrokerbotModule", (m) => {
  const brokerbot = m.contract("Brokerbot", [LCNS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default LCNSBrokerbotModule;
