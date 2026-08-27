import { network } from "hardhat";

async function main() {
  const connection = await network.create();
  const { ethers } = connection;

  // your BridgedSharesUnderAgreement contract
  const bridgedTokenAddress = "0x888910047aF011573C31C41B321c3224bf1D1998";
  // your BridgedSharesUnderAgreement token decimals
  const mintAmount = 100n;

  const [owner] = await ethers.getSigners();

  const bridged = await ethers.getContractAt(
    "BridgedSharesUnderAgreement",
    bridgedTokenAddress,
    owner
  );

  const originalPool = await bridged.pool();

  console.log("Owner:        ", owner.address);
  console.log("Current pool: ", originalPool);

  try {
    // swap pool to caller
    console.log("Setting temporary pool...");
    await (await bridged.setPool(owner.address)).wait();

    // mint to owner
    console.log("Minting...");
    await (await bridged.mint(owner.address, mintAmount)).wait();

    console.log(
      "Balance:",
      (await bridged.balanceOf(owner.address)).toString()
    );
  } finally {
    // always restore the original pool
    console.log("Restoring original pool...");
    await (await bridged.setPool(originalPool)).wait();

    console.log("Pool restored.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
