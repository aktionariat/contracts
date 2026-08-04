import { network } from "hardhat";

const tokenPool = "0xb006B5a69eC9AC9F0aDA285B2E6d32266694f9e6";
const localTokenAdminRegistry = "0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82";
const localToken = "0x11839d89507cF0489a028f871432bC8E5BbaFa3F";

async function main() {
  const { ethers } = await network.create();
  const [signer] = await ethers.getSigners();

  console.log("Using account:", signer.address);

  const TokenPool = await ethers.getContractAt("TokenPool", tokenPool, signer);

  const TokenAdminRegistry = await ethers.getContractAt(
    "TokenAdminRegistry",
    localTokenAdminRegistry,
    signer
  );

  console.log("Accepting token pool ownership...");
  const ownershipTx = await TokenPool.acceptOwnership();
  await ownershipTx.wait();

  console.log("Ownership accepted:", ownershipTx.hash);

  console.log("Accepting admin role...");
  const adminTx = await TokenAdminRegistry.acceptAdminRole(localToken);
  await adminTx.wait();

  console.log("Admin role accepted:", adminTx.hash);

  console.log("Done");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
