import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "YARU AG Shares";
const symbol = "AYON";
const terms = "https://ayon.fit/invest";
const draggable = true;
const numberOfShares = 10859;
const quorumDrag = 5100;
const quorumMigration = 5100;
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0x8157a05c3e8e35a01ee01d425b207ec6ec397eaa";

const AYONSharesDeploymentModule = buildModule("AYONSharesDeploymentModule", (m) => {
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

export default AYONSharesDeploymentModule;
