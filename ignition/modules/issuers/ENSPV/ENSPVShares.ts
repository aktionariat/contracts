import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "Energy SPV Shares";
const symbol = "ENSPV";
const terms = "https://shares.energyspv.com";
const draggable = true;
const numberOfShares = 1000000
const quorumDrag = 5100
const quorumMigration = 5100
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0xb802b54f8c8a16e68cf136bdd556d949710614e7";

const ENSPVSharesDeploymentModule = buildModule("ENSPVSharesDeploymentModule", (m) => {
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

export default ENSPVSharesDeploymentModule;
