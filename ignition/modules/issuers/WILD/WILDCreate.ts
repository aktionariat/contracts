import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deployment Configuration
const name = "Wildbiene + Partner AG Shares";
const symbol = "WILD";
const terms = "https://wildbieneundpartner.ch/investors";
const draggable = true;
const numberOfShares = 2262796;
const quorumDrag = 6667;
const quorumMigration = 6667;
const votePeriod = 5184000; 
const salt = "0";
const initialSigner = "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772";

const WILDNewDeploymentModule = buildModule("WILDNewDeploymentModule", (m) => {
  const aktionariatFactory = m.contractAt("AktionariatFactory", "0x2CFDD297F94b1843A18CB54a73EA46A3bfe3b9a8");  
  m.call(
    aktionariatFactory, 
    "createCompanyWithoutBrokerbot", 
    [
      [
        name,
        symbol,
        terms,
        draggable,
        numberOfShares,
        quorumDrag,
        quorumMigration,
        votePeriod
     ], 
     initialSigner,
     salt
    ]
  );

  return {};
});

export default WILDNewDeploymentModule;
