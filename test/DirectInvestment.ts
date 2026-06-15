import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, owner, signer1, signer2, signer3 } from "./TestBase.ts";
import { setZCHFBalance } from "../scripts/helpers/setBalance.ts";
import { ZCHF_ADDRESS } from "./Fixtures.ts";

// Tests for contracts/investment/DirectInvestment.sol + PaymentHub.sol.
//
// DirectInvestment (v10) is the successor to the old Brokerbot. It is BUY-ONLY: this suite
// ports the surviving Brokerbot functionality (pricing, settings, owner settlement, on-chain
// buy via PaymentHub) and drops what was removed (selling, getShares binary search, drift,
// keep-ether). The token being sold is a Shares instance; the payment currency is the real
// forked ZCHF (a plain ERC20), funded via storage manipulation.

const TERMS = "https://test.com/terms";
const PRICE = 1000n;
const INCREMENT = 10n;

async function deployShares(symbol: string, name: string): Promise<Contract> {
  const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
  const s = await Shares.deploy(symbol, name, TERMS, owner);
  await s.waitForDeployment();
  return s as unknown as Contract;
}

async function deployPaymentHub(): Promise<Contract> {
  // quoter/router are only used by the swap paths, which this suite does not exercise.
  const PaymentHub = await ethers.getContractFactory("contracts/investment/PaymentHub.sol:PaymentHub");
  const hub = await PaymentHub.deploy(owner, ethers.ZeroAddress, ethers.ZeroAddress);
  await hub.waitForDeployment();
  return hub as unknown as Contract;
}

async function deployDirectInvestment(token: Contract, base: Contract, paymentHub: string): Promise<Contract> {
  const DI = await ethers.getContractFactory("contracts/investment/DirectInvestment.sol:DirectInvestment");
  const di = await DI.deploy(token, PRICE, INCREMENT, base, owner, paymentHub);
  await di.waitForDeployment();
  return di as unknown as Contract;
}

// Reference implementation of the arithmetic series price, to cross-check getBuyPrice.
function expectedBuyPrice(shares: bigint): bigint {
  let total = 0n;
  let priceForShare = PRICE;
  for (let i = 0n; i < shares; i++) {
    total += priceForShare;
    priceForShare += INCREMENT;
  }
  return total;
}

describe("DirectInvestment (investment/DirectInvestment.sol)", function () {
  let token: Contract;   // the share token being sold (a real Shares securities token)
  let base: Contract;    // the payment currency (a plain ERC20)
  let hub: Contract;
  let di: Contract;

  beforeEach(async () => {
    token = await deployShares("TKN", "Token Shares");
    base = await ethers.getContractAt("contracts/ERC20/IERC20.sol:IERC20", ZCHF_ADDRESS);
    hub = await deployPaymentHub();
    di = await deployDirectInvestment(token, base, await hub.getAddress());
    // Give the DirectInvestment contract inventory to sell.
    await token.connect(owner).mint(di, 100000n);
  });

  describe("Deployment & params", function () {
    it("exposes constructor params", async () => {
      expect(await di.token()).to.equal(await token.getAddress());
      expect(await di.base()).to.equal(await base.getAddress());
      expect(await di.price()).to.equal(PRICE);
      expect(await di.increment()).to.equal(INCREMENT);
      expect(await di.owner()).to.equal(await owner.getAddress());
      expect(await di.paymenthub()).to.equal(await hub.getAddress());
      expect(await di.VERSION()).to.equal(10n);
      expect(await di.buyingEnabled()).to.equal(true);
    });
  });

  describe("Pricing (getBuyPrice)", function () {
    it("prices 0 and 1 share", async () => {
      expect(await di.getBuyPrice(0n)).to.equal(0n);
      expect(await di.getBuyPrice(1n)).to.equal(PRICE);
    });

    it("prices an arithmetic series with increment", async () => {
      for (const n of [2n, 5n, 17n, 100n, 999n]) {
        expect(await di.getBuyPrice(n)).to.equal(expectedBuyPrice(n));
      }
    });

    it("prices linearly with no increment", async () => {
      await di.connect(owner).setPrice(PRICE, 0n);
      for (const n of [2n, 50n, 1000n]) {
        expect(await di.getBuyPrice(n)).to.equal(PRICE * n);
      }
    });
  });

  describe("Settings", function () {
    it("setPrice is owner-only and updates state", async () => {
      await expect(di.connect(signer1).setPrice(5n, 1n)).to.revert(ethers);
      await di.connect(owner).setPrice(5n, 1n);
      expect(await di.price()).to.equal(5n);
      expect(await di.increment()).to.equal(1n);
    });

    it("setPaymentHub is owner-only", async () => {
      await expect(di.connect(signer1).setPaymentHub(signer1)).to.revert(ethers);
      await di.connect(owner).setPaymentHub(signer1);
      expect(await di.paymenthub()).to.equal(await signer1.getAddress());
    });

    it("setEnabled toggles buying (owner-only)", async () => {
      await expect(di.connect(signer1).setEnabled(false)).to.revert(ethers);
      await di.connect(owner).setEnabled(false);
      expect(await di.buyingEnabled()).to.equal(false);
      await di.connect(owner).setEnabled(true);
      expect(await di.buyingEnabled()).to.equal(true);
    });
  });

  describe("Owner-settled delivery (notifyTradeAndTransfer)", function () {
    it("delivers shares and bumps the price (owner-only)", async () => {
      const priceBefore = await di.price();
      await expect(di.connect(signer1).notifyTradeAndTransfer(signer1, 10n, 0n, "0x")).to.revert(ethers);
      await di.connect(owner).notifyTradeAndTransfer(signer1, 10n, 0n, "0x");
      expect(await token.balanceOf(signer1)).to.equal(10n);
      expect(await di.price()).to.equal(priceBefore + 10n * INCREMENT);
    });
  });

  describe("On-chain buy via PaymentHub", function () {
    it("buys shares paying in base currency", async () => {
      const amountShares = 10n;
      const buyPrice = await di.getBuyPrice(amountShares);

      // Fund the buyer with base currency and approve the hub.
      await setZCHFBalance(await signer1.getAddress(), buyPrice);
      await base.connect(signer1).approve(hub, buyPrice);

      await hub.connect(signer1).payFromBaseCurrencyAndNotify(di, amountShares, "0x");

      expect(await token.balanceOf(signer1)).to.equal(amountShares);
      expect(await base.balanceOf(signer1)).to.equal(0n);
      expect(await base.balanceOf(di)).to.equal(buyPrice);
    });

    it("reverts the buy when buying is disabled", async () => {
      await di.connect(owner).setEnabled(false);
      const buyPrice = await di.getBuyPrice(5n);
      await setZCHFBalance(await signer1.getAddress(), buyPrice);
      await base.connect(signer1).approve(hub, buyPrice);
      await expect(hub.connect(signer1).payFromBaseCurrencyAndNotify(di, 5n, "0x")).to.revert(ethers);
    });
  });

  describe("processIncoming exact-payment guard (the relocated price-bug fix)", function () {
    let diHubbed: Contract;
    beforeEach(async () => {
      // Deploy a DI whose paymentHub is an EOA so we can call processIncoming directly.
      diHubbed = await deployDirectInvestment(token, base, await signer3.getAddress());
      await token.connect(owner).mint(diHubbed, 10000n);
    });

    it("delivers shares for the exact price", async () => {
      const exact = await diHubbed.getBuyPrice(7n);
      await diHubbed.connect(signer3).processIncoming(signer1, 7n, exact, "0x");
      expect(await token.balanceOf(signer1)).to.equal(7n);
    });

    it("reverts on underpayment (amount != exact buy price)", async () => {
      const exact = await diHubbed.getBuyPrice(7n);
      await expect(diHubbed.connect(signer3).processIncoming(signer1, 7n, exact - 1n, "0x")).to.revert(ethers);
    });

    it("rejects callers other than the payment hub", async () => {
      const exact = await diHubbed.getBuyPrice(7n);
      await expect(diHubbed.connect(signer1).processIncoming(signer1, 7n, exact, "0x")).to.revert(ethers);
    });
  });

  describe("migrate", function () {
    it("moves token and base balances to a successor and disables buying", async () => {
      await setZCHFBalance(await di.getAddress(), 555n);
      const successor = await deployDirectInvestment(token, base, await hub.getAddress());

      const tokenBal = await token.balanceOf(di);
      await di.connect(owner).migrate(successor);

      expect(await token.balanceOf(successor)).to.equal(tokenBal);
      expect(await base.balanceOf(successor)).to.equal(555n);
      expect(await di.buyingEnabled()).to.equal(false);
    });
  });
});
