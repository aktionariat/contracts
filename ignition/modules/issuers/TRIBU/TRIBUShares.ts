import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "Tribus Urbaines SA Shares";
const symbol = "TRIBU";
const terms = "https://token.tribusurbaines.com";
const draggable = true;
const numberOfShares = 511720;
const quorumDrag = 7500;
const quorumMigration = 7500;
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0xA40852c32d142733390c03E1eB549B20f58b37C9";
const companyMultisigAddress = "0x9122DdD4bed618833FfA6DD78D9eCD450517066e";

const TRIBUSharesDeploymentModule = buildModule("TRIBUSharesDeploymentModule", (m) => {
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

export default TRIBUSharesDeploymentModule;
