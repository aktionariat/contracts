import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "The Bike Company AG Shares ";
const symbol = "BIKE";
const terms = "https://transalpes.ch/token";
const draggable = true;
const numberOfShares = 110500
const quorumDrag = 5100
const quorumMigration = 5100
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0xda0b338dc007b59e6cc8317ca3495089b320ae9c";

const BIKESharesDeploymentModule = buildModule("BIKESharesDeploymentModule", (m) => {
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

export default BIKESharesDeploymentModule;
