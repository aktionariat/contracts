import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deployment Configuration
const name = "axelion Invest AG Shares";
const symbol = "AXE";
const terms = "https://investors.axelion.ch";
const draggable = true;
const numberOfShares = 1000000;
const quorumDrag = 6667;
const quorumMigration = 6667;
const votePeriod = 5184000; 
const multisig = "0xbaad655c6bd9c089887a0174c7c45233f73e33f3";
const salt = "0";
const price = 100000000000000000n;
const increment = 0;
const baseCurrency = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";


const AXESNewDeploymentModule = buildModule("AXESNewDeploymentModule", (m) => {
  const aktionariatFactory = m.contractAt("AktionariatFactory", "0x2CFDD297F94b1843A18CB54a73EA46A3bfe3b9a8");  
  m.call(
    aktionariatFactory, 
    "createCompanyExistingMultisig", 
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
      [
        price,
        increment,
        baseCurrency
     ], 
     multisig, 
     salt
    ]
  );

  return {};
});

export default AXESNewDeploymentModule;
