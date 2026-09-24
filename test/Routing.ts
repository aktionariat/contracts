import { expect } from "chai";
import { Contract } from "ethers";
import { network } from "hardhat";
import KEYS from "../KEYS.ts";
import { UNISWAP_QUOTER_V2, UNISWAP_UNIVERSAL_ROUTER, ZCHF_ADDRESS } from "./Fixtures.ts";

// Tests for the Uniswap payment paths of contracts/investment/PaymentHub.sol against the real
// mainnet pools, QuoterV2 and Universal Router: getPriceInPaymentCurrency,
// payFromOtherCurrencyAndNotify, payFromEtherAndNotify.
//
// Almost all ZCHF liquidity sits in the Uniswap V3 ZCHF/USDT 0.01% pool, so every route ends with
// the USDT -> ZCHF hop. USDT's transfer/approve return no bool; the USDT cases are the regression
// test for the router paying pools from its own balance with such tokens.
//
// Runs on its own connection, forked at a pinned block so pool state and results are reproducible.

const FORK_BLOCK = 26045000;

const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const IERC20 = "contracts/ERC20/IERC20.sol:IERC20";
const IROUTER = "contracts/investment/IUniswap.sol:IUniversalRouter";
const TERMS = "https://test.com/terms";
const PRICE = 10n * 10n ** 18n;     // 10 ZCHF
const INCREMENT = 10n ** 18n;       // +1 ZCHF per share
const SHARES_TO_BUY = 5n;
const REF = "0x1234";

// exactOutput paths are encoded output first: ZCHF <fee> hop <fee> ... paymentCurrency.
const ROUTES: { name: string; token: string; hops: (string | number)[] }[] = [
  { name: "USDT", token: USDT, hops: [ZCHF_ADDRESS, 100, USDT] },
  { name: "USDC", token: USDC, hops: [ZCHF_ADDRESS, 100, USDT, 100, USDC] },
  { name: "DAI", token: DAI, hops: [ZCHF_ADDRESS, 100, USDT, 100, DAI] },
  { name: "WBTC", token: WBTC, hops: [ZCHF_ADDRESS, 100, USDT, 500, WBTC] },
  { name: "WETH", token: WETH, hops: [ZCHF_ADDRESS, 100, USDT, 500, WETH] },
];

const connection = await network.connect({
  override: { forking: { url: KEYS.alchemy.mainnet, blockNumber: FORK_BLOCK, enabled: true } },
});
const { ethers, provider } = connection;
const [owner, investor] = await ethers.getSigners();

function encodePath(hops: (string | number)[]): string {
  return ethers.solidityPacked(hops.map(h => (typeof h === "number" ? "uint24" : "address")), hops);
}

async function latestTimestamp(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))!.timestamp;
}

async function deadline(): Promise<number> {
  return (await latestTimestamp()) + 600;
}

// Gives `holder` exactly `amount` of `token` by writing its balance mapping slot directly.
// Tokens lay out `mapping(address => uint256) balances` at different slots, so probe for it.
async function setTokenBalance(token: Contract, holder: string, amount: bigint) {
  const address = await token.getAddress();
  const value = ethers.toBeHex(amount, 32);
  for (let slot = 0; slot < 20; slot++) {
    const key = ethers.solidityPackedKeccak256(["uint256", "uint256"], [holder, slot]);
    const previous = await provider.request({ method: "eth_getStorageAt", params: [address, key, "latest"] });
    await provider.request({ method: "hardhat_setStorageAt", params: [address, key, value] });
    if ((await token.balanceOf(holder)) === amount) return;
    await provider.request({ method: "hardhat_setStorageAt", params: [address, key, previous] });
  }
  throw new Error(`balance slot not found for ${address}`);
}

// Funds and approves `amount` of `token` for the investor. USDT rejects a non-zero -> non-zero approve.
async function fundAndApprove(token: Contract, amount: bigint) {
  await setTokenBalance(token, investor.address, amount);
  await token.connect(investor).approve(hub, 0n);
  await token.connect(investor).approve(hub, amount);
}

let shares: Contract;
let zchf: Contract;
let hub: Contract;
let router: Contract;
let di: Contract;

describe("PaymentHub routing (forked mainnet)", function () {
  before(async () => {
    const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
    shares = (await Shares.deploy("TKN", "Token Shares", TERMS, owner)) as unknown as Contract;

    const PaymentHub = await ethers.getContractFactory("contracts/investment/PaymentHub.sol:PaymentHub");
    hub = (await PaymentHub.deploy(owner, UNISWAP_QUOTER_V2, UNISWAP_UNIVERSAL_ROUTER)) as unknown as Contract;
    router = await ethers.getContractAt(IROUTER, UNISWAP_UNIVERSAL_ROUTER);

    zchf = await ethers.getContractAt(IERC20, ZCHF_ADDRESS);
    const DI = await ethers.getContractFactory("contracts/investment/DirectInvestment.sol:DirectInvestment");
    di = (await DI.deploy(shares, PRICE, INCREMENT, zchf, owner, hub)) as unknown as Contract;

    await shares.connect(owner).mint(di, 1000n);
  });

  describe("checkPath", function () {
    it("rejects malformed paths", async () => {
      const valid = encodePath([ZCHF_ADDRESS, 500, WETH]);
      const invalid: Record<string, string> = {
        "too short": encodePath([ZCHF_ADDRESS]),
        "bad length": valid + "00",
        "does not start with base": encodePath([WETH, 500, WETH]),
        "does not end with payment currency": encodePath([ZCHF_ADDRESS, 100, USDT]),
      };
      for (const [reason, path] of Object.entries(invalid)) {
        await expect(hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, WETH, path), reason)
          .to.be.revertedWithCustomError(hub, "PaymentHub_InvalidPath");
      }
    });

    it("requires an ETH payment path to end in WETH", async () => {
      const path = encodePath([ZCHF_ADDRESS, 100, USDT]);
      await expect(hub.connect(investor).payFromEtherAndNotify(di, SHARES_TO_BUY, path, await deadline(), REF, { value: 1n }))
        .to.be.revertedWithCustomError(hub, "PaymentHub_InvalidPath");
    });
  });

  describe("payFromOtherCurrencyAndNotify", function () {
    for (const route of ROUTES) {
      it(`pays in ${route.name} via ${route.name === "USDT" ? "the USDT/ZCHF pool" : "USDT"}`, async () => {
        const token = await ethers.getContractAt(IERC20, route.token);
        const path = encodePath(route.hops);
        const cost: bigint = await di.getBuyPrice(SHARES_TO_BUY);
        const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, route.token, path);
        expect(quoted).to.be.greaterThan(0n);

        // Send twice the quote; the router must swap exactly the quoted amount and return the rest.
        const amountInMaximum = quoted * 2n;
        await fundAndApprove(token, amountInMaximum);

        const tx = hub.connect(investor).payFromOtherCurrencyAndNotify(di, SHARES_TO_BUY, route.token, amountInMaximum, path, await deadline(), REF);
        await expect(tx).to.emit(di, "Trade");
        await expect(tx).to.changeTokenBalances(ethers, token, [investor, hub, router], [-quoted, 0n, 0n]);
        await expect(tx).to.changeTokenBalances(ethers, zchf, [di, hub, router], [cost, 0n, 0n]);
        await expect(tx).to.changeTokenBalances(ethers, shares, [investor, di], [SHARES_TO_BUY, -SHARES_TO_BUY]);
      });
    }

    it("reverts when amountInMaximum is below the quote", async () => {
      const usdt = await ethers.getContractAt(IERC20, USDT);
      const path = encodePath([ZCHF_ADDRESS, 100, USDT]);
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, USDT, path);
      await fundAndApprove(usdt, quoted - 1n);

      await expect(hub.connect(investor).payFromOtherCurrencyAndNotify(di, SHARES_TO_BUY, USDT, quoted - 1n, path, await deadline(), REF))
        .to.be.revertedWithCustomError(router, "V3TooMuchRequested");
    });

    it("reverts after the deadline", async () => {
      const usdt = await ethers.getContractAt(IERC20, USDT);
      const path = encodePath([ZCHF_ADDRESS, 100, USDT]);
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, USDT, path);
      await fundAndApprove(usdt, quoted);

      // The next block is at least one second after the latest one.
      await expect(hub.connect(investor).payFromOtherCurrencyAndNotify(di, SHARES_TO_BUY, USDT, quoted, path, await latestTimestamp(), REF))
        .to.be.revertedWithCustomError(router, "TransactionDeadlinePassed");
    });

    it("accepts a deadline equal to the block timestamp", async () => {
      const usdt = await ethers.getContractAt(IERC20, USDT);
      const path = encodePath([ZCHF_ADDRESS, 100, USDT]);
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, USDT, path);
      await fundAndApprove(usdt, quoted);

      const at = (await latestTimestamp()) + 100;
      await provider.request({ method: "evm_setNextBlockTimestamp", params: [at] });
      await expect(hub.connect(investor).payFromOtherCurrencyAndNotify(di, SHARES_TO_BUY, USDT, quoted, path, at, REF))
        .to.emit(di, "Trade");
    });

    it("rejects zero shares", async () => {
      const path = encodePath([ZCHF_ADDRESS, 100, USDT]);
      await expect(hub.connect(investor).payFromOtherCurrencyAndNotify(di, 0n, USDT, 1n, path, await deadline(), REF))
        .to.be.revertedWithCustomError(hub, "PaymentHub_InvalidAmount");
    });
  });

  describe("payFromEtherAndNotify", function () {
    const path = encodePath([ZCHF_ADDRESS, 100, USDT, 500, WETH]);

    it("pays in ETH via WETH and USDT, returning the change as ETH", async () => {
      const weth = await ethers.getContractAt(IERC20, WETH);
      const cost: bigint = await di.getBuyPrice(SHARES_TO_BUY);
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, WETH, path);
      const value = quoted * 2n;

      const tx = hub.connect(investor).payFromEtherAndNotify(di, SHARES_TO_BUY, path, await deadline(), REF, { value });
      await expect(tx).to.emit(di, "Trade");
      await expect(tx).to.changeEtherBalances(ethers, [investor, hub, router], [-quoted, 0n, 0n]);
      await expect(tx).to.changeTokenBalances(ethers, weth, [investor, hub, router], [0n, 0n, 0n]);
      await expect(tx).to.changeTokenBalances(ethers, zchf, [di, hub, router], [cost, 0n, 0n]);
      await expect(tx).to.changeTokenBalances(ethers, shares, [investor, di], [SHARES_TO_BUY, -SHARES_TO_BUY]);
    });

    it("reverts when msg.value is below the quote", async () => {
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, WETH, path);
      await expect(hub.connect(investor).payFromEtherAndNotify(di, SHARES_TO_BUY, path, await deadline(), REF, { value: quoted - 1n }))
        .to.be.revertedWithCustomError(router, "V3TooMuchRequested");
    });

    it("reverts after the deadline", async () => {
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, WETH, path);
      await expect(hub.connect(investor).payFromEtherAndNotify(di, SHARES_TO_BUY, path, await latestTimestamp(), REF, { value: quoted }))
        .to.be.revertedWithCustomError(router, "TransactionDeadlinePassed");
    });

    it("rejects zero shares", async () => {
      await expect(hub.connect(investor).payFromEtherAndNotify(di, 0n, path, await deadline(), REF, { value: 1n }))
        .to.be.revertedWithCustomError(hub, "PaymentHub_InvalidAmount");
    });
  });
});
