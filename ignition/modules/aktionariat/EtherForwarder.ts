import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EtherForwarderModule = buildModule("EtherForwarderModule", (m) => {
  const etherForwarder = m.contract("EtherForwarder", []);

  return { 
    etherForwarder
   };
});

export default EtherForwarderModule;
