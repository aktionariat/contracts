import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LpeNewDeploymentModule = buildModule("LpeNewDeploymentModule", (m) => {
  const aktionariatFactory = m.contractAt("AktionariatFactory", "0x2CFDD297F94b1843A18CB54a73EA46A3bfe3b9a8");  
  m.call(
    aktionariatFactory, 
    "createCompanyWithoutBrokerbotExistingMultisig", 
    [
      [
      "La Petite Épicerie SA Shares",
      "LPE",
      "invest.lapetiteepicerie.ch",
      true,
      10000000,
      7500,
      5010,
      5184000
     ], 
     "0x4119a84bF63dAD56aE2daE7697C22a7De09b1E12", 
     "0"
    ]
  );

  return {};
});

export default LpeNewDeploymentModule;
