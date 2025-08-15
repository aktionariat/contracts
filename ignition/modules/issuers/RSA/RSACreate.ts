import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deployment Configuration
const name = "Revario SA Shares";
const symbol = "RSA";
const terms = "https://www.revario.ch/pages/crowdinvesting";
const draggable = true;
const numberOfShares = 39732;
const quorumDrag = 7500;
const quorumMigration = 5100;
const votePeriod = 5184000; 
const salt = "0";
const price = "1000000000000000000";
const increment = "0";
const baseCurrency = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB"
const multisig = "0x4bb3c05dbf07c3167993cf7ad3c6ffae65fc0378";

const RSANewDeploymentModule = buildModule("RSANewDeploymentModule", (m) => {
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

export default RSANewDeploymentModule;
