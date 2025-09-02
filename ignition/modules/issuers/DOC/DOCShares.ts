import { utf8ToBytes } from "@nomicfoundation/ethereumjs-util";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

// Deployment Configuration
const name = "docjo Holding AG Shares";
const symbol = "DOC";
const terms = "https://invest.docjo.health";
const draggable = true;
const numberOfShares = 4456996;
const quorumDrag = 6600;
const quorumMigration = 6600;
const votePeriod = 5184000; 
const salt = ethers.keccak256(utf8ToBytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0x53b75ea6fa0250d36409ec682fc282af089d0de8";

const DOCSharesDeploymentModule = buildModule("DOCSharesDeploymentModule", (m) => {
  const tokenFactory = m.contractAt("TokenFactory", tokenFactoryAddress);
  m.call(
    tokenFactory, 
    "createToken", 
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
     companyMultisigAddress,
     salt
    ]
  );

  return {};
});

export default DOCSharesDeploymentModule;
