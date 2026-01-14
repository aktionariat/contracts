import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "Swisschain Holding SA Shares";
const symbol = "SCH";
const terms = "https://invest.swisschainholding.ch";
const draggable = true;
const numberOfShares = 10616665
const quorumDrag = 5100
const quorumMigration = 5100
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0xaa95dcbc18f5dca4aa8799daa7acf29b28c1b604";

const SCHSharesDeploymentModule = buildModule("SCHSharesDeploymentModule", (m) => {
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

export default SCHSharesDeploymentModule;
