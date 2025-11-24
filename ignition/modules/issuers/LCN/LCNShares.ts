import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "Licorn Group SA Shares";
const symbol = "LCN";
const terms = "https://licorn.ch/investir";
const draggable = true;
const numberOfShares = 10000000
const quorumDrag = 6667
const quorumMigration = 6667
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0x3a3c22eee11bcc8877a81739e2fc42809587e7c5";

const LCNSharesDeploymentModule = buildModule("LCNSharesDeploymentModule", (m) => {
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

export default LCNSharesDeploymentModule;
