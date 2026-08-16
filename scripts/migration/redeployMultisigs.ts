// One-time migration: redeploy every affected company's multisig on the new (fixed)
// LINK-only MultichainWallet factory, preserving the exact signer set of the old buggy
// wallet, then sync the signers from mainnet to the L2 clones over CCIP.
//
// The old MultichainWallet.sync() let an attacker drain fee funds; the fixed stack was
// rolled out on 2026-08-14. This script moves each company onto a fresh wallet with the
// SAME signers. It does NOT touch the backend DB — switching the platform over to the new
// addresses (register new CompanyHasMultisig, retire the old one) is a separate step.
//
// Usage:
//   npx hardhat run scripts/migration/redeployMultisigs.ts                 # dry run (no txs)
//   EXECUTE=true npx hardhat run scripts/migration/redeployMultisigs.ts    # send real txs
//   ONLY=62030,60103 EXECUTE=true npx hardhat run ...                      # restrict to some ids
//   PHASE=deploy|sync  EXECUTE=true npx hardhat run ...                    # run one phase only
//
// Prerequisites for a real run:
//   - The deployer (mnemonic account 0 in KEYS.ts) must be the same address on all chains,
//     funded with gas on mainnet/optimism/polygon and with enough LINK on mainnet for the
//     CCIP sync fees (one fee per L2 target per company).
//   - CCIP delivery to the L2s is asynchronous: after the sync tx confirms on mainnet the
//     L2 signer state lands minutes later. This script fires the syncs; it does not wait
//     for L2 delivery.

import hre from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AFFECTED_COMPANIES, type AffectedCompany } from "./affectedCompanies.ts";

const FACTORY = "0xfed81dace77c0d11cace61304ec60efcd04379a9";

const CHAINS = ["mainnet", "optimism", "polygon"] as const;
type Chain = (typeof CHAINS)[number];

const ROUTER: Record<Chain, string> = {
  mainnet: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
  optimism: "0x3206695CaE29952f4b0c22a169725a865bc8Ce0f",
  polygon: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe",
};
const LINK: Record<Chain, string> = {
  mainnet: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  optimism: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
  polygon: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", // native ERC677 LINK (the one CCIP accepts)
};
const SELECTOR: Record<Chain, bigint> = {
  mainnet: 5009297550715157269n,
  optimism: 3734403246176062136n,
  polygon: 4051577828743386545n,
};
const L2_TARGETS: Chain[] = ["optimism", "polygon"];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];
const ROUTER_ABI = [
  "function getFee(uint64 destinationChainSelector, (bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256)",
];

// Fixed per-wallet LINK approval for the CCIP sync fee (actual fee is ~0.05-0.1 LINK per
// company; this leaves generous headroom for fee drift while staying bounded — see note in
// syncPhase on why this must not be unlimited).
const APPROVAL_PER_WALLET_LINK = process.env.APPROVAL_PER_WALLET_LINK ?? "1";

const EXECUTE = process.env.EXECUTE === "true";
const PHASE = process.env.PHASE ?? "all"; // "deploy" | "sync" | "all"
const ONLY = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, "state");
const STATE_FILE = join(STATE_DIR, "progress.json");

type Progress = { deployed: Record<string, string[]>; synced: string[] }; // deployed: id -> chains; synced: ids
function loadProgress(): Progress {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  return { deployed: {}, synced: [] };
}
function saveProgress(p: Progress) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(p, null, 2));
}

// Rebuilds the exact EVM2AnyMessage that MultichainWallet._buildSyncMessage produces,
// so the CCIP fee can be quoted from the real router with getFee.
function buildSyncMessage(eth: any, wallet: string, signers: string[], powers: number[], feeToken: string) {
  const abi = eth.AbiCoder.defaultAbiCoder();
  return {
    receiver: abi.encode(["address"], [wallet]),
    data: abi.encode(["address[]", "uint8[]"], [signers, powers]),
    tokenAmounts: [],
    feeToken,
    extraArgs: eth.concat(["0x181dcf10", abi.encode(["uint256", "bool"], [100_000, true])]),
  };
}

function companies(): AffectedCompany[] {
  return ONLY.length ? AFFECTED_COMPANIES.filter((c) => ONLY.includes(c.id)) : AFFECTED_COMPANIES;
}

async function main() {
  console.log(`\n=== Multisig redeploy migration ===`);
  console.log(`mode: ${EXECUTE ? "EXECUTE (sending real transactions)" : "DRY RUN (no transactions)"}  phase: ${PHASE}`);
  console.log(`companies: ${companies().length}${ONLY.length ? " (filtered)" : ""}\n`);

  const conn: Record<string, any> = {};
  const deployer: Record<string, any> = {};
  for (const c of CHAINS) {
    conn[c] = await hre.network.connect(c);
    deployer[c] = (await conn[c].ethers.getSigners())[0];
  }
  const addrs = new Set(CHAINS.map((c) => deployer[c].address.toLowerCase()));
  if (addrs.size !== 1) throw new Error(`Deployer address differs across chains: ${[...addrs].join(", ")}`);
  console.log(`deployer: ${deployer.mainnet.address}`);
  for (const c of CHAINS) {
    const bal = await conn[c].ethers.provider.getBalance(deployer[c].address);
    console.log(`  ${c.padEnd(9)} gas balance: ${conn[c].ethers.formatEther(bal)}`);
  }

  const progress = loadProgress();

  if (PHASE === "all" || PHASE === "deploy") await deployPhase(conn, deployer, progress);
  if (PHASE === "all" || PHASE === "sync") await syncPhase(conn, deployer, progress);

  console.log(`\nDone.`);
}

async function deployPhase(conn: any, deployer: any, progress: Progress) {
  console.log(`\n--- Phase 1: deploy clones (createWithSigners) on ${CHAINS.join(", ")} ---`);
  for (const c of CHAINS) {
    const eth = conn[c].ethers;
    const factory = await eth.getContractAt("MultichainWalletFactory", FACTORY, deployer[c]);
    console.log(`\n[${c}]`);
    for (const co of companies()) {
      const predicted = await factory.predict(co.salt);
      if (predicted.toLowerCase() !== co.newMultisig.toLowerCase()) {
        console.log(`  !! ${co.name} (${co.id}) predict mismatch: ${predicted} vs snapshot ${co.newMultisig} — SKIP`);
        continue;
      }
      const code = await eth.provider.getCode(predicted);
      if (code !== "0x") {
        // Already deployed (prior run, or a front-runner). On mainnet the signer set is
        // load-bearing, so never silently trust it: verify it matches the snapshot and
        // abort loudly if it doesn't (e.g. someone deployed this address with other signers).
        if (c === "mainnet") await verifyMainnetSigners(eth, co);
        console.log(`  = ${co.name} (${co.id}) already deployed at ${predicted}${c === "mainnet" ? " (signers verified)" : ""}`);
        recordDeployed(progress, co.id, c);
        continue;
      }
      console.log(`  ${EXECUTE ? "+" : "~"} ${co.name} (${co.id}) createWithSigners(${co.signers.length} signers) -> ${predicted}`);
      if (EXECUTE) {
        await (await factory.createWithSigners(co.signers, co.powers, co.salt)).wait();
        if (c === "mainnet") await verifyMainnetSigners(eth, co);
        recordDeployed(progress, co.id, c);
        saveProgress(progress);
      }
    }
  }
}

async function verifyMainnetSigners(eth: any, co: AffectedCompany) {
  const wallet = await eth.getContractAt("MultichainWalletMaster", co.newMultisig);
  const count = await wallet.signerCount();
  if (count !== BigInt(co.signers.length)) throw new Error(`${co.name}: signerCount ${count} != ${co.signers.length}`);
  for (let i = 0; i < co.signers.length; i++) {
    const p = await wallet.signers(co.signers[i]);
    if (p !== BigInt(co.powers[i])) throw new Error(`${co.name}: signer ${co.signers[i]} power ${p} != ${co.powers[i]}`);
  }
}

async function syncPhase(conn: any, deployer: any, progress: Progress) {
  console.log(`\n--- Phase 2: sync signers mainnet -> ${L2_TARGETS.join(", ")} (CCIP, LINK fee) ---`);
  const eth = conn.mainnet.ethers;
  const link = new eth.Contract(LINK.mainnet, ERC20_ABI, deployer.mainnet);
  const router = new eth.Contract(ROUTER.mainnet, ROUTER_ABI, eth.provider);
  const targets = L2_TARGETS.map((c) => SELECTOR[c]);

  let grandTotal = 0n;
  const plan: { co: AffectedCompany; fee: bigint }[] = [];
  for (const co of companies()) {
    if (progress.synced.includes(String(co.id))) {
      console.log(`  = ${co.name} (${co.id}) already synced`);
      continue;
    }
    let fee = 0n;
    for (const c of L2_TARGETS) {
      const msg = buildSyncMessage(eth, co.newMultisig, co.signers, co.powers, LINK.mainnet);
      fee += await router.getFee(SELECTOR[c], msg);
    }
    plan.push({ co, fee });
    grandTotal += fee;
  }

  const linkBal = await link.balanceOf(deployer.mainnet.address);
  console.log(`\n  total CCIP fee needed: ${eth.formatEther(grandTotal)} LINK; deployer LINK balance: ${eth.formatEther(linkBal)}`);
  if (EXECUTE && linkBal < grandTotal) throw new Error(`Insufficient LINK: need ${eth.formatEther(grandTotal)}, have ${eth.formatEther(linkBal)}`);

  for (const { co, fee } of plan) {
    // Allowance is necessarily per-wallet: sync() does LINK.transferFrom with the wallet as
    // the ERC20 spender, so each company's wallet needs its own approval (no single global
    // approval can cover them). We approve a fixed, generous-but-BOUNDED amount so fee drift
    // between quote and execution can never make sync revert; only the actual fee is pulled,
    // the rest stays as a standing allowance. NOT unbounded on purpose: a wallet can execute()
    // arbitrary calls, so an unlimited LINK allowance from the deployer to a company's multisig
    // could be drained by that company via execute(LINK.transferFrom(deployer, ...)).
    const approval = eth.parseEther(APPROVAL_PER_WALLET_LINK);
    console.log(`  ${EXECUTE ? "+" : "~"} ${co.name} (${co.id}) sync -> [${L2_TARGETS.join(",")}] fee ${eth.formatEther(fee)} LINK (approve ${eth.formatEther(approval)})`);
    if (EXECUTE) {
      const wallet = await eth.getContractAt("MultichainWalletMaster", co.newMultisig, deployer.mainnet);
      await (await link.approve(co.newMultisig, approval)).wait();
      await (await wallet["sync(uint64[],address[])"](targets, co.signers)).wait();
      progress.synced.push(String(co.id));
      saveProgress(progress);
    }
  }
}

function recordDeployed(p: Progress, id: number, chain: string) {
  const key = String(id);
  p.deployed[key] = [...new Set([...(p.deployed[key] ?? []), chain])];
}

await main();