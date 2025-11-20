import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SHOWS_Address = "0xf9af4c818521d1878699aa0ede6cddcffd0cf958";
const ZCHF_Address = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const price = 10000000000000000n;
const increment = 0n;
const owner = "0xb40b89e4efef694d5f7c82e3a7cec72c718e1ddc";
const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";

const SHOWSBrokerbotModule = buildModule("SHOWSBrokerbotModule", (m) => {
  const brokerbot = m.contract("Brokerbot", [SHOWS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default SHOWSBrokerbotModule;
