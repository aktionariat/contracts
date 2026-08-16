// State-aware cleanup for L2 signer syncs that failed the 100k CCIP callback limit.
// For each company it reads signerCount on Optimism and Polygon; for any chain still
// below the expected count it re-syncs the FULL signer set to THAT chain only, in
// chunks of CHUNK (default 2) so every _ccipReceive callback stays well under 100k.
// Re-setting an already-present signer is idempotent, so this is safe to re-run.
//
// Usage:
//   npx hardhat run scripts/migration/cleanupSync.ts                 # dry run
//   EXECUTE=true npx hardhat run scripts/migration/cleanupSync.ts    # send
//   CHUNK=2 EXECUTE=true npx hardhat run ...                         # override chunk size

import hre from "hardhat";
import { AFFECTED_COMPANIES } from "./affectedCompanies.ts";

const LINK_MAINNET = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const SELECTOR: Record<string, bigint> = { optimism: 3734403246176062136n, polygon: 4051577828743386545n };
const CHUNK = Number(process.env.CHUNK ?? 2);
const EXECUTE = process.env.EXECUTE === "true";
const APPROVAL_LINK = process.env.APPROVAL_PER_WALLET_LINK ?? "1";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
const WALLET_ABI = ["function signerCount() view returns (uint16)"];

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  console.log(`\n=== State-aware L2 sync cleanup ===  mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}  chunk=${CHUNK}\n`);
  const mainnet = await hre.network.connect("mainnet");
  const optimism = await hre.network.connect("optimism");
  const polygon = await hre.network.connect("polygon");
  const eth = mainnet.ethers;
  const deployer = (await eth.getSigners())[0];
  const link = new eth.Contract(LINK_MAINNET, ERC20_ABI, deployer);
  const readers: Record<string, any> = { optimism: optimism.ethers, polygon: polygon.ethers };
  console.log(`deployer: ${deployer.address}  LINK: ${eth.formatEther(await link.balanceOf(deployer.address))}\n`);

  let acted = 0;
  for (const co of AFFECTED_COMPANIES) {
    const exp = co.signers.length;
    const deficient: string[] = [];
    for (const c of ["optimism", "polygon"]) {
      const cnt = Number(await new readers[c].Contract(co.newMultisig, WALLET_ABI, readers[c].provider).signerCount());
      if (cnt < exp) deficient.push(c);
    }
    if (deficient.length === 0) continue;
    acted++;
    const selectors = deficient.map((c) => SELECTOR[c]);
    const chunks = chunk(co.signers, CHUNK);
    console.log(`${co.name} (${co.id})  short on [${deficient.join(",")}]  -> ${chunks.length} sync tx(s) of <=${CHUNK} signers to those chain(s)`);
    if (!EXECUTE) continue;

    const wallet = await eth.getContractAt("MultichainWalletMaster", co.newMultisig, deployer);
    await (await link.approve(co.newMultisig, eth.parseEther(APPROVAL_LINK))).wait();
    for (const [i, ch] of chunks.entries()) {
      const tx = await wallet["sync(uint64[],address[])"](selectors, ch);
      const r = await tx.wait();
      console.log(`    chunk ${i + 1}/${chunks.length} (${ch.length} signers) -> ${r.hash}`);
    }
  }
  console.log(`\n${acted === 0 ? "Nothing to do — all chains at target." : acted + " companies processed."}`);
}

await main();
