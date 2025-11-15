import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SECS_Address = "0xea391f908cc394795ee9c2e94ebadc4a1b5d861b";
const ZCHF_Address = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const price = 10000000000000000n;
const increment = 0n;
const owner = "0x0ab9345ff4fbddcbfc6f31ab8a4d4cd06adece39";
const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";

const SECSBrokerbotModule = buildModule("SECSBrokerbotModule", (m) => {
  const brokerbot = m.contract("Brokerbot", [SECS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default SECSBrokerbotModule;
