import { utf8ToBytes } from "@nomicfoundation/ethereumjs-util";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

// Deployment Configuration
const name = "ARTISAN ROASTERS AG Shares ";
const symbol = "ONE";
const terms = "https://invest.onesto.ch";
const draggable = true;
const numberOfShares = 14877;
const quorumDrag = 7500;
const quorumMigration = 7500;
const votePeriod = 5184000; 
const salt = ethers.keccak256(utf8ToBytes(symbol));

const tokenFactoryAddress = "0x388A6CD4D59673fd7959C51D9937cBbe55Ad7720";
const companyMultisigAddress = "0xc754ada0856dcf573b7d5f4770d374802a05ead4";

const ONESharesDeploymentModule = buildModule("ONESharesDeploymentModule", (m) => {
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

export default ONESharesDeploymentModule;
