import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ENSPVS_Address = "0xE6f96DF2EF13f225bC7543350c1a8fF075777a02";
const ZCHF_Address = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const price = 10000000000000000n;
const increment = 0n;
const owner = "0xb802b54f8c8a16e68cf136bdd556d949710614e7";
const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";

const ENSPVSBrokerbotModule = buildModule("ENSPVSBrokerbotModule", (m) => {
  const brokerbot = m.contract("Brokerbot", [ENSPVS_Address, price, increment, ZCHF_Address, owner, paymentHubAddress]);

  return { 
    brokerbot
   };
});

export default ENSPVSBrokerbotModule;
