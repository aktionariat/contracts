import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SNXS_Address = "0x859336669A5AeE857810E59716b0db08468F9F84";
const ZCHF_Address = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const price = 10000000000000000n;
const increment = 0n;
const owner = "0x5faf3ccd8180725c42114a455abdd1abafaa990a";
const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";

const SNXSBrokerbotModule = buildModule("SNXSBrokerbotModule", (m) => {
  const brokerbot = m.contract("Brokerbot", [SNXS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default SNXSBrokerbotModule;
