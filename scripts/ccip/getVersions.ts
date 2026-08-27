import { network } from "hardhat";

// change "mainnet" to fetch different networks: can be made CLI variable
const networkName = "mainnet";
const connect = await network.create(networkName);

// router address: can be made CLI variable
const routerAddress = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

const router = await connect.ethers.getContractAt(
  ["function typeAndVersion() view returns (string)"],
  routerAddress
);

console.log(
  `For network ${networkName}, Chainlink CCIP router has version: ${await router.typeAndVersion()}`
);
