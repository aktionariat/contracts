import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deployment Configuration
const initialSigner = "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772";
const symbol = "WILD";
const salt = "0";

const WILDMultichainMultisigModule = buildModule("WILDMultichainMultisigModule", (m) => {
  const aktionariatFactory = m.contractAt("AktionariatFactory", "0x2CFDD297F94b1843A18CB54a73EA46A3bfe3b9a8");  
  m.call(
    aktionariatFactory, 
    "createMultisig", 
    [
     initialSigner,
     symbol,
     salt
    ]
  );

  return {};
});

export default WILDMultichainMultisigModule;
