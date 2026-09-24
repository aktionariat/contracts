import { expect } from "chai";
import { Contract } from "ethers";
import { network } from "hardhat";
import KEYS from "../KEYS.ts";
import { ZCHF_ADDRESS } from "./Fixtures.ts";

// Tests for the Uniswap V3 payment paths of contracts/investment/PaymentHub.sol against the real
// mainnet pools: getPriceInPaymentCurrency, payFromOtherCurrencyAndNotify, payFromEtherAndNotify.
//
// Almost all ZCHF liquidity sits in the Uniswap V3 ZCHF/USDT 0.01% pool, so every route ends with
// the USDT -> ZCHF hop. USDT's `approve` returns no bool, which is why PaymentHub.approveERC20 has
// to use forceApprove; the USDT cases below are the regression test for that.
//
// Runs on its own connection, forked at a pinned block so pool state and results are reproducible.

const FORK_BLOCK = 26045000;

const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

// Uniswap V3 periphery v1, as used by PaymentHub v12.
const QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const IERC20 = "contracts/ERC20/IERC20.sol:IERC20";
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

describe("PaymentHub routing (forked mainnet)", function () {
  let shares: Contract;
  let zchf: Contract;
  let hub: Contract;
  let di: Contract;

  before(async () => {
    const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
    shares = (await Shares.deploy("TKN", "Token Shares", TERMS, owner)) as unknown as Contract;

    const PaymentHub = await ethers.getContractFactory("contracts/investment/PaymentHub.sol:PaymentHub");
    hub = (await PaymentHub.deploy(owner, QUOTER, SWAP_ROUTER)) as unknown as Contract;

    zchf = await ethers.getContractAt(IERC20, ZCHF_ADDRESS);
    const DI = await ethers.getContractFactory("contracts/investment/DirectInvestment.sol:DirectInvestment");
    di = (await DI.deploy(shares, PRICE, INCREMENT, zchf, owner, hub)) as unknown as Contract;

    await shares.connect(owner).mint(di, 1000n);
  });

  describe("approveERC20", function () {
    it("approves USDT, whose approve returns no bool", async () => {
      const usdt = await ethers.getContractAt(IERC20, USDT);
      await hub.approveERC20(USDT);
      expect(await usdt.allowance(hub, SWAP_ROUTER)).to.equal(ethers.MaxUint256);
    });

    it("re-approves USDT, which rejects changing a non-zero allowance", async () => {
      // USDT reverts approve(x) while the allowance is non-zero; forceApprove resets to 0 first.
      const usdt = await ethers.getContractAt(IERC20, USDT);
      await hub.approveERC20(USDT);
      await hub.approveERC20(USDT);
      expect(await usdt.allowance(hub, SWAP_ROUTER)).to.equal(ethers.MaxUint256);
    });

    it("approves several currencies at once", async () => {
      await hub.approvePaymentCurrencies(ROUTES.map(r => r.token));
      for (const route of ROUTES) {
        const token = await ethers.getContractAt(IERC20, route.token);
        expect(await token.allowance(hub, SWAP_ROUTER), route.name).to.equal(ethers.MaxUint256);
      }
    });
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
  });

  describe("payFromOtherCurrencyAndNotify", function () {
    for (const route of ROUTES) {
      it(`pays in ${route.name} via ${route.name === "USDT" ? "the USDT/ZCHF pool" : "USDT"}`, async () => {
        const token = await ethers.getContractAt(IERC20, route.token);
        const path = encodePath(route.hops);
        const cost: bigint = await di.getBuyPrice(SHARES_TO_BUY);
        const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, route.token, path);
        expect(quoted).to.be.greaterThan(0n);

        // Send twice the quote; the hub must swap exactly the quoted amount and refund the rest.
        const amountInMaximum = quoted * 2n;
        await setTokenBalance(token, investor.address, amountInMaximum);
        await token.connect(investor).approve(hub, amountInMaximum);
        await hub.approveERC20(route.token);

        const tx = hub.connect(investor).payFromOtherCurrencyAndNotify(di, SHARES_TO_BUY, route.token, amountInMaximum, path, REF);
        await expect(tx).to.emit(di, "Trade");
        await expect(tx).to.changeTokenBalances(ethers, token, [investor, hub], [-quoted, 0n]);
        await expect(tx).to.changeTokenBalances(ethers, zchf, [di, hub], [cost, 0n]);
        await expect(tx).to.changeTokenBalances(ethers, shares, [investor, di], [SHARES_TO_BUY, -SHARES_TO_BUY]);
      });
    }

    it("reverts when amountInMaximum is below the quote", async () => {
      const usdt = await ethers.getContractAt(IERC20, USDT);
      const path = encodePath([ZCHF_ADDRESS, 100, USDT]);
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, USDT, path);

      await setTokenBalance(usdt, investor.address, quoted);
      await usdt.connect(investor).approve(hub, 0n); // USDT: reset before setting a new allowance
      await usdt.connect(investor).approve(hub, quoted - 1n);
      await hub.approveERC20(USDT);

      await expect(hub.connect(investor).payFromOtherCurrencyAndNotify(di, SHARES_TO_BUY, USDT, quoted - 1n, path, REF))
        .to.be.revert(ethers);
    });
  });

  describe("payFromEtherAndNotify", function () {
    it("pays in ETH via WETH and USDT, refunding the rest as WETH", async () => {
      const weth = await ethers.getContractAt(IERC20, WETH);
      const path = encodePath([ZCHF_ADDRESS, 100, USDT, 500, WETH]);
      const cost: bigint = await di.getBuyPrice(SHARES_TO_BUY);
      const quoted: bigint = await hub.getPriceInPaymentCurrency.staticCall(di, SHARES_TO_BUY, WETH, path);
      const value = quoted * 2n;
      await hub.approveERC20(WETH);

      const tx = hub.connect(investor).payFromEtherAndNotify(di, SHARES_TO_BUY, path, REF, { value });
      await expect(tx).to.emit(di, "Trade");
      await expect(tx).to.changeEtherBalance(ethers, investor, -value);
      await expect(tx).to.changeTokenBalances(ethers, weth, [investor, hub], [value - quoted, 0n]);
      await expect(tx).to.changeTokenBalances(ethers, zchf, [di, hub], [cost, 0n]);
      await expect(tx).to.changeTokenBalances(ethers, shares, [investor, di], [SHARES_TO_BUY, -SHARES_TO_BUY]);
    });
  });
});
