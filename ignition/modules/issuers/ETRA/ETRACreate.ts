import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deployment Configuration
const name = "Eteria AG Shares";
const symbol = "ETRA";
const terms = "https://eteria.ch/investors";
const draggable = true;
const numberOfShares = 10000000;
const quorumDrag = 5010;
const quorumMigration = 5010;
const votePeriod = 5184000; 
const multisig = "0xBFEEf4381263D9DbB831F715Cc83cC8E6163d7ea";
const salt = "0";
const price = 10000000000000000n;
const increment = 0;
const baseCurrency = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";


const ETRANewDeploymentModule = buildModule("ETRANewDeploymentModule", (m) => {
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

export default ETRANewDeploymentModule;
