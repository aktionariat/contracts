import { expect } from "chai";
import { Contract, ContractFactory, Signer } from "ethers";
import { ethers, owner, signer1, signer3 } from "../../../test/TestBase.ts";
import { mockArtifacts } from "./lib/mockArtifacts.ts";

// Proof-of-concept tests for unchecked / unsafe external calls in the `ai-audit` branch.
//
//   Finding 1 — SecondaryMarket.withdrawFees (SecondaryMarket.sol:276-285): the two
//               `IERC20(currency).transfer(...)` calls are made with a bool-returning
//               interface but the return value is ignored AND the call is not wrapped in
//               try/catch or low-level call. Two failure modes:
//                 1a. USDT-like currency (transfer returns NO data): the high-level call
//                     REVERTS (returndatasize mismatch), so the owner can never withdraw
//                     fees — permanent DoS on fee withdrawal for USDT-denominated markets.
//                 1b. transfer returns false: the call is silently swallowed; the owner and
//                     LICENSE_FEE_RECIPIENT are never paid, funds are stuck forever, and
//                     a LicenseFeePaid event is emitted as if the payment succeeded.
//               The default market currency is ZCHF (a plain ERC20), but the market
//               supports USDT-like currencies — USDT and bridged USDT are by far the most
//               common secondary-market currencies and are handled identically here.
//   Finding 2 — MultichainWallet.sync (MultichainWallet.sol:72-82): the fee-token branch
//               ignores the return values of `transferFrom`/`approve` (2a), and the native
//               overpayment refund uses `payable(msg.sender).call` whose failure is
//               deliberately ignored (2b). A smart-contract sender without receive()/fallback()
//               overpays and the excess is permanently locked in the wallet (matching the
//               already-reported DeterrenceFee.sol:57-62 pattern).

const SEPOLIA_CHAIN = 5009297550715157269n;
const FEE = ethers.parseEther("0.1");

async function deployMock(
  name: string,
  signer: Signer,
  args: unknown[] = []
): Promise<Contract> {
  const art = mockArtifacts[name];
  const factory = new ContractFactory(art.abi, art.bytecode, signer);
  const c = await factory.deploy(...args);
  await c.waitForDeployment();
  return c;
}

async function deployShares(): Promise<Contract> {
  const Shares = await ethers.getContractFactory(
    "contracts/shares/base/Shares.sol:Shares"
  );
  const shares = await Shares.deploy(
    "TST",
    "Test Company Shares",
    "https://test.com/terms",
    owner
  );
  await shares.waitForDeployment();
  return shares as unknown as Contract;
}

describe("Finding 1 — SecondaryMarket.withdrawFees: unchecked IERC20.transfer return", function () {
  let shares: Contract;
  let ownerAddr: string;

  beforeEach(async function () {
    shares = await deployShares();
    ownerAddr = await owner.getAddress();
  });

  async function deployMarket(currency: Contract): Promise<Contract> {
    const SM = await ethers.getContractFactory(
      "contracts/market/SecondaryMarket.sol:SecondaryMarket"
    );
    const market = await SM.deploy(
      ownerAddr,
      await currency.getAddress(),
      await shares.getAddress(),
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );
    await market.waitForDeployment();
    return market as unknown as Contract;
  }

  it("1a. EXPLOIT: USDT-like currency (no return value) makes withdrawFees revert permanently", async function () {
    const usdt = await deployMock("MockNoReturnToken", signer1);
    const market = await deployMarket(usdt);
    const marketAddr = await market.getAddress();
    const deposited = 1000_000_000n; // 1'000 USDT with 6 decimals
    await usdt.mint(marketAddr, deposited);

    expect(await usdt.balanceOf(marketAddr)).to.equal(deposited);
    // transfer() returns no data -> the compiled returndatasize check reverts.
    await expect(market.connect(owner).withdrawFees()).to.be.revert(ethers);
    // Fees remain stuck in the market.
    expect(await usdt.balanceOf(marketAddr)).to.equal(deposited);
  });

  it("1b. EXPLOIT: transfer returning false is silently swallowed — no payment, event still emitted", async function () {
    const badToken = await deployMock("MockFalseReturnToken", signer1);
    const market = await deployMarket(badToken);
    const marketAddr = await market.getAddress();
    const deposited = ethers.parseEther("100");
    await badToken.mint(marketAddr, deposited);

    // split = 50% -> owner 50, LICENSE_FEE_RECIPIENT 50
    await expect(market.connect(owner).withdrawFees())
      .to.emit(market, "LicenseFeePaid")
      .withArgs(
        await badToken.getAddress(),
        "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
        ethers.parseEther("50")
      );

    // transfer() returned false and nothing moved: both recipients got zero.
    expect(await badToken.balanceOf(marketAddr)).to.equal(deposited);
    expect(await badToken.balanceOf(ownerAddr)).to.equal(0n);
    expect(
      await badToken.balanceOf("0x29Fe8914e76da5cE2d90De98a64d0055f199d06D")
    ).to.equal(0n);
  });

  it("CONTROL: a standard bool-returning ERC20 (Shares) withdraws fees correctly", async function () {
    const market = await deployMarket(shares);
    const marketAddr = await market.getAddress();
    const deposited = ethers.parseEther("100");
    await shares.connect(owner).mint(marketAddr, deposited);

    await market.connect(owner).withdrawFees();

    const recipient = "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D";
    expect(await shares.balanceOf(marketAddr)).to.equal(0n);
    expect(await shares.balanceOf(ownerAddr)).to.equal(ethers.parseEther("50"));
    expect(await shares.balanceOf(recipient)).to.equal(ethers.parseEther("50"));
  });
});

describe("Finding 2 — MultichainWallet.sync: unchecked refund and unchecked fee-token returns", function () {
  let wallet: Contract;
  let router: Contract;
  let walletAddr: string;

  beforeEach(async function () {
    router = await deployMock("MockCCIPRouter", signer1, [FEE]);

    const ArgSource = await ethers.getContractFactory(
      "contracts/multisig/MultichainWalletArgumentSource.sol:MultichainWalletArgumentSource"
    );
    const argSource = await ArgSource.deploy();
    await argSource.waitForDeployment();
    await argSource.initialize(await router.getAddress());

    const Master = await ethers.getContractFactory(
      "contracts/multisig/MultiSigWalletMaster.sol:MultiSigWalletMaster"
    );
    wallet = await Master.deploy(await argSource.getAddress());
    await wallet.waitForDeployment();
    await wallet.initialize(await owner.getAddress());
    walletAddr = await wallet.getAddress();
  });

  it("2b. EXPLOIT: overpaid native fee from a contract sender is locked in the wallet forever", async function () {
    const caller = await deployMock("MockSyncCaller", signer1);
    const overpay = FEE * 2n; // double the 0.1 ETH fee
    await caller.callSync(
      walletAddr,
      SEPOLIA_CHAIN,
      await signer1.getAddress(),
      { value: overpay }
    );

    // The refund to the receive-less caller failed silently; the wallet keeps the excess.
    expect(await ethers.provider.getBalance(walletAddr)).to.equal(FEE);
    // And the router got only the fee.
    expect(
      await ethers.provider.getBalance(await router.getAddress())
    ).to.equal(FEE);
  });

  it("CONTROL: an EOA sender gets the overpaid fee refunded", async function () {
    const overpay = FEE * 2n;
    const before = await ethers.provider.getBalance(await signer3.getAddress());
    await wallet
      .connect(signer3)
      ["sync(uint64,address[],address)"](
        SEPOLIA_CHAIN,
        [await signer1.getAddress()],
        ethers.ZeroAddress,
        { value: overpay }
      );
    const after = await ethers.provider.getBalance(await signer3.getAddress());

    // signer3 paid 0.2 ETH but received 0.1 ETH back -> net 0.1 ETH spent (gas ignored).
    expect(after).to.be.gt(before - FEE - ethers.parseEther("0.01"));
    expect(await ethers.provider.getBalance(walletAddr)).to.equal(0n);
  });

  it("2a. EXPLOIT: USDT-like fee token reverts sync (transferFrom return ignored, but returndata mismatch)", async function () {
    const usdt = await deployMock("MockNoReturnToken", signer1);
    await usdt.mint(await signer3.getAddress(), ethers.parseEther("1000"));

    await expect(
      wallet
        .connect(signer3)
        ["sync(uint64,address[],address)"](
          SEPOLIA_CHAIN,
          [await signer1.getAddress()],
          await usdt.getAddress()
        )
    ).to.be.revert(ethers);
  });
});
