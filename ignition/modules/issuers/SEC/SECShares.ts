import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, toUtf8Bytes } from "ethers";


// Deployment Configuration
const name = "Secondary Market SA";
const symbol = "SEC";
const terms = "https://shares.aktionariat.com";
const draggable = true;
const numberOfShares = 1000000
const quorumDrag = 5100
const quorumMigration = 5100
const votePeriod = 5184000; 
const salt = ethers.keccak256(toUtf8Bytes(symbol));

const tokenFactoryAddress = "0xA40852c32d142733390c03E1eB549B20f58b37C9";
const companyMultisigAddress = "0x0AB9345fF4fbDdCbFc6f31ab8a4D4cd06adecE39";

const SECSharesDeploymentModule = buildModule("SECSharesDeploymentModule", (m) => {
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

export default SECSharesDeploymentModule;
