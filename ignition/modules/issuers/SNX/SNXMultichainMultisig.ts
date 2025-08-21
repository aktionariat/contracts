import { utf8ToBytes } from "@nomicfoundation/ethereumjs-util";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

// Deployment Configuration
const multiSigCloneFactoryAddress = "0x2CFDD297F94b1843A18CB54a73EA46A3bfe3b9a8";
const initialSigner = "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772";
const salt = "SNX";

const SNXMultichainMultisigModule = buildModule("SNXMultichainMultisigModule", (m) => {
  // Deploy Multisig
  const multiSigCloneFactory = m.contractAt("MultiSigCloneFactory", multiSigCloneFactoryAddress);  
  m.call(multiSigCloneFactory, "create", [initialSigner, ethers.keccak256(utf8ToBytes(salt))], { from: initialSigner });

  return {};
});

export default SNXMultichainMultisigModule;
