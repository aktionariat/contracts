import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// MEX Configuration
const name = "Multichain Example AG Shares";
const symbol = "MEX";
const terms = "https://aktionariat.com";
const totalShares = 1000000;
const owner = "0x42a78187D178CA2249C854730FC583779b5455cD";
const recoveryHub = "0x5e200B3C6e9ce8280dbB14A0E5486895456136EF"
const permit2Hub = "0xd3DE54d9e424BF27b8259E69B205127722c771Cb"


// MMEXS Configuration
const quorumDrag = 5010;
const quorumMigration = 5010;
const votePeriod = 5184000; 
const offerFactory = "0x9eA6427f76b27F939942941fFbA43667F4e2a45c"
const ccipAdmin = "0xdCaa50578efe0A2AB95767A6DC41d104d543E8D9"


const MEXMasterMainnetDeploymentModule = buildModule("MEXMasterMainnetDeploymentModule", (m) => {
  const MEXShares = m.contract("AllowlistShares", [
    symbol,
    name,
    terms,
    totalShares,
    recoveryHub,
    owner,
    permit2Hub
  ])

  const MultichainMEXSMasterMainnet = m.contract("MultichainSharesMaster", 
    [
      terms,
      [
        MEXShares,
        quorumDrag,
        quorumMigration,
        votePeriod       
      ],
      recoveryHub,
      offerFactory,
      owner,
      permit2Hub,
      ccipAdmin
    ]
  );

  return {
    MEXShares,
    MultichainMEXSMasterMainnet
  };
});

export default MEXMasterMainnetDeploymentModule;
