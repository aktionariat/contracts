import { network } from "hardhat";

const TOKEN_POOL_ADDRESS = "0xf8Ea62940b66DC8F67cf266FA29eC57B88EfF3D9";

async function main() {
  const tokenPool = await (
    await network.create()
  ).ethers.getContractAt("TokenPool", TOKEN_POOL_ADDRESS);

  const admin = await tokenPool.getRateLimitAdmin();

  console.log("Rate Limit Admin:", admin);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
