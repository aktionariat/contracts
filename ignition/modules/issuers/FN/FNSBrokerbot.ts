import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FNS_Address = "0x0BFC78463c5e766e5c42F2DfF8d46d3286e28fe9";
const ZCHF_Address = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const price = 10000000000000000n;
const increment = 0n;
const owner = "0x9450faf3f3881b86d485b121f59e3946b8aeda88";
const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";

const FNSBrokerbotModule = buildModule("FNSBrokerbotModule", (m) => {
  const brokerbot = m.contract("Brokerbot", [FNS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default FNSBrokerbotModule;
