import { expect } from "chai";
import { Contract, HDNodeWallet, Signature } from "ethers";
import { ethers, provider, deployer, owner } from "./TestBase.ts";

// Signature scheme of contracts/multisig/MultiSigWallet.sol.
//
// Signers sign the EIP-155 preimage of a legacy transaction whose fields are repurposed:
//   nonce    = sequence (bit 127 set, so it can never be a real account nonce)
//   gasPrice = contractId (low 32 bits of the wallet address XOR chain id)
//   gasLimit = 21000
//   to, value, data as given, then chainId, 0, 0.
// The wallet rebuilds the RLP on-chain and recovers the signers from the hash. This test
// builds the hash with ethers' RLP encoder, independent of the contract's, so a change in
// the on-chain encoder that alters a single byte fails here.

const TERMS = "https://test.com/terms";
const NONCE_MASK = 1n << 127n;

const wallets = { a: HDNodeWallet.createRandom(), b: HDNodeWallet.createRandom(), c: HDNodeWallet.createRandom(), d: HDNodeWallet.createRandom() };

function minimal(x: bigint | number): string {
  return ethers.toBeHex(x) === "0x00" ? "0x" : ethers.hexlify(ethers.toBeArray(x));
}

function transactionHash(sequence: bigint, contractId: bigint, to: string, value: bigint, data: string, chainId: bigint): string {
  const fields = [minimal(sequence), minimal(contractId), minimal(21000), to, minimal(value), data, minimal(chainId), "0x", "0x"];
  return ethers.keccak256(ethers.encodeRlp(fields));
}

describe("MultiSigWallet signatures", function () {
  let wallet: Contract;
  let shares: Contract;
  let walletAddress: string;
  let contractId: bigint;
  let chainId: bigint;
  let sequence = NONCE_MASK; // first proposal uses (NONCE_MASK | 1)

  function nextSequence(): bigint {
    sequence += 1n;
    return sequence;
  }

  function sign(signers: HDNodeWallet[], seq: bigint, to: string, value: bigint, data: string) {
    const hash = transactionHash(seq, contractId, to, value, data, chainId);
    const sigs = signers.map(s => Signature.from(s.signingKey.sign(hash)));
    return { v: sigs.map(s => s.v), r: sigs.map(s => s.r), s: sigs.map(s => s.s) };
  }

  async function execute(signers: HDNodeWallet[], seq: bigint, to: string, value: bigint, data: string) {
    const { v, r, s } = sign(signers, seq, to, value, data);
    return wallet.connect(deployer).execute(seq, to, value, data, v, r, s);
  }

  before(async function () {
    chainId = (await ethers.provider.getNetwork()).chainId;

    // Same stack as production: Rollout deploys source, master and factory.
    const Rollout = await ethers.getContractFactory("Rollout");
    const rollout = await Rollout.deploy();
    const factoryAddress = await rollout.rollout.staticCall(owner.address, owner.address); // router/link unused here
    await (await rollout.rollout(owner.address, owner.address)).wait();
    const factory = await ethers.getContractAt("MultichainWalletFactory", factoryAddress);

    // a alone suffices (power 1); b and c need two signatures (power 2).
    const salt = ethers.encodeBytes32String("SIGTEST");
    walletAddress = await factory.predict(salt);
    await (await factory.createWithSigners([wallets.a.address, wallets.b.address, wallets.c.address], [1, 2, 2], salt)).wait();
    wallet = await ethers.getContractAt("MultichainWalletMaster", walletAddress);

    await provider.request({ method: "hardhat_setBalance", params: [walletAddress, ethers.toBeHex(10n ** 30n)] });
    contractId = ethers.toBigInt(await wallet.contractId());

    const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
    shares = (await Shares.deploy("TKN", "Token Shares", TERMS, walletAddress)) as unknown as Contract;
  });

  it("derives contractId from the low 32 bits of the address and the chain id", async function () {
    expect(contractId).to.equal((BigInt(walletAddress) & 0xffffffffn) ^ chainId);
  });

  it("hashes exactly like a legacy transaction", async function () {
    // Same fields through ethers' transaction serializer (nonce must fit a JS number there).
    const tx = ethers.Transaction.from({ type: 0, nonce: 5, gasPrice: contractId, gasLimit: 21000, to: owner.address, value: 7n, data: "0x1234", chainId });
    expect(transactionHash(5n, contractId, owner.address, 7n, "0x1234", chainId)).to.equal(tx.unsignedHash);
  });

  it("checkSignatures recovers the signers", async function () {
    const seq = NONCE_MASK | 1n;
    const { v, r, s } = sign([wallets.b, wallets.c], seq, owner.address, 1n, "0x");
    expect(await wallet.checkSignatures(seq, owner.address, 1n, "0x", v, r, s)).to.deep.equal([wallets.b.address, wallets.c.address]);
  });

  it("encodes the boundary cases of sequence, value and data like ethers", async function () {
    // checkSignatures only hashes and recovers, so nothing is executed or flagged used.
    const sequences = [0n, 1n, 0x7fn, 0x80n, 0xffn, 0x100n, NONCE_MASK | 1n, (1n << 128n) - 1n];
    const values = [0n, 0x7fn, 0x80n, (1n << 256n) - 1n];
    const datas = ["0x", "0x00", "0x01", "0x7f", "0x80", "0xff", "0x" + "ab".repeat(55), "0x" + "ab".repeat(56), "0x" + "ab".repeat(255), "0x" + "ab".repeat(256)];
    for (const seq of sequences) for (const value of values) for (const data of datas) {
      const { v, r, s } = sign([wallets.b, wallets.c], seq, owner.address, value, data);
      expect(await wallet.checkSignatures(seq, owner.address, value, data, v, r, s), `${seq} ${value} ${data.length}`)
        .to.deep.equal([wallets.b.address, wallets.c.address]);
    }
  });

  it("sends ether with empty data", async function () {
    const seq = nextSequence();
    const value = ethers.parseEther("1");
    const tx = execute([wallets.a], seq, owner.address, value, "0x");
    await expect(tx).to.changeEtherBalances(ethers, [walletAddress, owner], [-value, value]);
    await expect(tx).to.emit(wallet, "Transacted").withArgs(owner.address, "0x00000000", [wallets.a.address]);
    await expect(tx).to.emit(wallet, "SentEth").withArgs(owner.address, value);
  });

  it("sends a large value, encoded in more than 8 bytes", async function () {
    const value = 10n ** 29n; // 13 bytes
    await expect(execute([wallets.a], nextSequence(), owner.address, value, "0x"))
      .to.changeEtherBalances(ethers, [walletAddress, owner], [-value, value]);
  });

  it("calls itself with data between 56 and 255 bytes", async function () {
    const data = wallet.interface.encodeFunctionData("setSigner", [wallets.d.address, 1]); // 68 bytes
    const tx = execute([wallets.a], nextSequence(), walletAddress, 0n, data);
    await expect(tx).to.emit(wallet, "Transacted").withArgs(walletAddress, data.slice(0, 10), [wallets.a.address]);
    await expect(tx).to.emit(wallet, "SignerChange").withArgs(wallets.d.address, 1);
    expect(await wallet.signers(wallets.d.address)).to.equal(1);
  });

  it("calls a contract with data longer than 255 bytes, signed by two signers", async function () {
    const terms = "https://example.com/" + "x".repeat(300);
    const data = shares.interface.encodeFunctionData("setTerms", [terms]);
    expect(ethers.dataLength(data)).to.be.greaterThan(255);
    const tx = execute([wallets.b, wallets.c], nextSequence(), await shares.getAddress(), 0n, data);
    await expect(tx).to.emit(wallet, "Transacted").withArgs(await shares.getAddress(), data.slice(0, 10), [wallets.b.address, wallets.c.address]);
    expect(await shares.terms()).to.equal(terms);
  });

  it("accepts a sequence without the mask bit", async function () {
    // The wallet strips bit 127 before bookkeeping; the backend always sets it.
    await expect(execute([wallets.a], 5n, owner.address, 1n, "0x")).to.emit(wallet, "SentEth");
  });

  it("rejects a single signature from a signer with power 2", async function () {
    await expect(execute([wallets.b], nextSequence(), owner.address, 1n, "0x"))
      .to.be.revertedWithCustomError(wallet, "Multisig_InvalidSignDataOrInsufficientCosigner").withArgs(wallets.b.address);
  });

  it("rejects a signature over a different sequence", async function () {
    const seq = nextSequence();
    const { v, r, s } = sign([wallets.a], seq, owner.address, 1n, "0x");
    await expect(wallet.connect(deployer).execute(seq + 1n, owner.address, 1n, "0x", v, r, s))
      .to.be.revertedWithCustomError(wallet, "Multisig_InvalidSignDataOrInsufficientCosigner");
  });

  it("rejects a signature over different data", async function () {
    const seq = nextSequence();
    const { v, r, s } = sign([wallets.a], seq, owner.address, 1n, "0x");
    await expect(wallet.connect(deployer).execute(seq, owner.address, 2n, "0x", v, r, s))
      .to.be.revertedWithCustomError(wallet, "Multisig_InvalidSignDataOrInsufficientCosigner");
  });

  it("rejects a replay of a used sequence", async function () {
    const seq = nextSequence();
    await execute([wallets.a], seq, owner.address, 1n, "0x");
    await expect(execute([wallets.a], seq, owner.address, 1n, "0x"))
      .to.be.revertedWithCustomError(wallet, "Nonce_AlreadyUsed").withArgs(seq);
  });

  it("rejects duplicate signatures", async function () {
    await expect(execute([wallets.b, wallets.b], nextSequence(), owner.address, 1n, "0x"))
      .to.be.revertedWithCustomError(wallet, "Multisig_DuplicateSignature").withArgs(wallets.b.address);
  });

  it("rejects a non-signer", async function () {
    const stranger = HDNodeWallet.createRandom();
    await expect(execute([stranger], nextSequence(), owner.address, 1n, "0x"))
      .to.be.revertedWithCustomError(wallet, "Multisig_InvalidSignDataOrInsufficientCosigner").withArgs(stranger.address);
  });

  it("rejects a call with data to an address without code", async function () {
    await expect(execute([wallets.a], nextSequence(), owner.address, 0n, "0x1234"))
      .to.be.revertedWithCustomError(wallet, "Multisig_NotAContract").withArgs(owner.address);
  });

  it("bubbles the revert of the called contract", async function () {
    // Shares is owned by the wallet, so transferring ownership away and then setting terms reverts inside Shares.
    const sharesAddress = await shares.getAddress();
    await execute([wallets.a], nextSequence(), sharesAddress, 0n, shares.interface.encodeFunctionData("transferOwnership", [owner.address]));
    await expect(execute([wallets.a], nextSequence(), sharesAddress, 0n, shares.interface.encodeFunctionData("setTerms", ["x"])))
      .to.be.revertedWithCustomError(shares, "Ownable_NotOwner").withArgs(walletAddress);
  });

  it("checkExecution reverts with the test-passed marker", async function () {
    await expect(wallet.checkExecution(owner.address, 1n, "0x")).to.be.revertedWith("Test passed. Reverting.");
  });
});
