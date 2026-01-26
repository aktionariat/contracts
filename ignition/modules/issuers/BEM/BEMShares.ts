import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";

// Deployment Configuration
const name = "BeEmotion.AI SA Shares";
const symbol = "BEM";
const terms = "https://invest.beemotion.ai";
const draggable = true;
const numberOfShares = 484311000
const quorumDrag = 7500
const quorumMigration = 7500
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0x02b3739ebe45822b5573a5870b84834db52b9b6c";

const BEMSharesDeploymentModule = buildModule("BEMSharesDeploymentModule", (m) => {
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

export default BEMSharesDeploymentModule;
