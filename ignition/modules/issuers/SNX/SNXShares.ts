import { utf8ToBytes } from "@nomicfoundation/ethereumjs-util";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

// Deployment Configuration
const name = "TYXIT SA Shares";
const symbol = "SNX";
const terms = "https://invest.sonixapp.com";
const draggable = true;
const numberOfShares = 29968;
const quorumDrag = 6000;
const quorumMigration = 6000;
const votePeriod = 5184000; 
const salt = ethers.keccak256(utf8ToBytes(symbol));

const tokenFactoryAddress = "0xA40852c32d142733390c03E1eB549B20f58b37C9";
const companyMultisigAddress = "0x5faf3CCD8180725c42114a455AbDD1abAFAa990A";

const SNXSharesDeploymentModule = buildModule("SNXSharesDeploymentModule", (m) => {
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

export default SNXSharesDeploymentModule;
