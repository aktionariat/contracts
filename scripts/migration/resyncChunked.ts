// Remedy for wallets whose bulk sync callback exceeded the 100k CCIP gas limit
// (>=4 signers). Splits each company's signer set into two chunks and syncs each
// separately, so every _ccipReceive callback stays well under 100k gas.
//
// Usage:
//   npx hardhat run scripts/migration/resyncChunked.ts                 # dry run
//   EXECUTE=true npx hardhat run scripts/migration/resyncChunked.ts    # send
//   IDS=66734,58400 EXECUTE=true npx hardhat run ...                   # override targets

import hre from "hardhat";
import { AFFECTED_COMPANIES } from "./affectedCompanies.ts";

const LINK_MAINNET = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const SELECTOR = { optimism: 3734403246176062136n, polygon: 4051577828743386545n };
const TARGETS = [SELECTOR.optimism, SELECTOR.polygon];

const EXECUTE = process.env.EXECUTE === "true";
const IDS = (process.env.IDS ?? "66734,58400").split(",").map((s) => Number(s.trim()));
const APPROVAL_LINK = process.env.APPROVAL_PER_WALLET_LINK ?? "1";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];

function splitInTwo(arr: any[]) {
  const mid = Math.ceil(arr.length / 2);
  return [arr.slice(0, mid), arr.slice(mid)];
}

async function main() {
  console.log(`\n=== Chunked re-sync ===  mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}  targets: ${IDS.join(", ")}\n`);
  const conn = await hre.network.connect("mainnet");
  const eth = conn.ethers;
  const deployer = (await eth.getSigners())[0];
  const link = new eth.Contract(LINK_MAINNET, ERC20_ABI, deployer);
  console.log(`deployer: ${deployer.address}  LINK: ${eth.formatEther(await link.balanceOf(deployer.address))}\n`);

  for (const id of IDS) {
    const co = AFFECTED_COMPANIES.find((c) => c.id === id);
    if (!co) { console.log(`  ${id}: not found in affectedCompanies.ts`); continue; }
    const [chunkA, chunkB] = splitInTwo(co.signers);
    console.log(`${co.name} (${id})  wallet ${co.newMultisig}`);
    console.log(`  tx1: sync ${chunkA.length} signers -> [optimism,polygon]`);
    console.log(`  tx2: sync ${chunkB.length} signers -> [optimism,polygon]`);
    if (!EXECUTE) continue;

    const wallet = await eth.getContractAt("MultichainWalletMaster", co.newMultisig, deployer);
    await (await link.approve(co.newMultisig, eth.parseEther(APPROVAL_LINK))).wait();
    for (const [i, chunk] of [chunkA, chunkB].entries()) {
      const tx = await wallet["sync(uint64[],address[])"](TARGETS, chunk);
      const r = await tx.wait();
      console.log(`    tx${i + 1} sent: ${r.hash}`);
    }
  }
  console.log(`\nDone.`);
}

await main();
