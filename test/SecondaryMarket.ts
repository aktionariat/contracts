import { expect } from "chai";
import { Contract, MaxInt256 } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5, signer6, signer7 } from "./TestBase.ts";
import { buyerIntentConfig, getNamedStruct, getSignature, sellerIntentConfig } from "./Intent.ts";
import { setZCHFBalance } from "../scripts/helpers/setBalance.ts";
import { deployFixture, deploySecondaryMarket, mintAndWrap } from "./Fixtures.ts";


describe("SecondaryMarket", function () {
  let secondaryMarket: Contract;
  let secondaryMarketWithRouter: Contract;
  let shares: Contract        // base/Shares.sol (replaces old allowlistShares)
  let sharesUnderAgreement: Contract           // SharesUnderAgreement.sol, the traded token (replaces old allowlistDraggableShares)
  let zchf: Contract;
  const router = deployer; // Use an existing signer as router

  // Convenience method to create 2 matching intents for testing
  // Calling this on the same block should return the same intents
  // Whereas calling it after a transaction or manual mining should return new, different intents
  async function createMatchingIntents() {
    const buyerIntent = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature = await getSignature(signer1, buyerIntent, await secondaryMarket.getAddress());    
    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await secondaryMarket.getAddress());
    return { buyerIntent, buyerSignature, sellerIntent, sellerSignature }
  }

  before(async function() {
    ({ zchf, shares, sharesUnderAgreement } = await connection.networkHelpers.loadFixture(deployFixture));
    secondaryMarket = await deploySecondaryMarket(owner, zchf, sharesUnderAgreement, ethers.ZeroAddress);
    secondaryMarketWithRouter = await deploySecondaryMarket(owner, zchf, sharesUnderAgreement, router);

    // Set balances and allowances of buyer and seller
    await setZCHFBalance(signer1.address, ethers.parseUnits("100000", 18));
    await setZCHFBalance(signer3.address, ethers.parseUnits("100000", 18));
    await setZCHFBalance(signer4.address, ethers.parseUnits("100000", 18));
    await setZCHFBalance(signer5.address, ethers.parseUnits("100000", 18));
    await zchf.connect(signer1).approve(secondaryMarket, ethers.parseUnits("100000", 18));
    await zchf.connect(signer3).approve(secondaryMarket, ethers.parseUnits("100000", 18));
    await zchf.connect(signer4).approve(secondaryMarket, ethers.parseUnits("100000", 18));
    await zchf.connect(signer5).approve(secondaryMarket, ethers.parseUnits("100000", 18));
    await mintAndWrap(shares, sharesUnderAgreement, signer2.address, ethers.parseUnits("1000", 0));
    await sharesUnderAgreement.connect(signer2).approve(secondaryMarket, ethers.parseUnits("100000", 0));
  });

  it("Deploy with and without router", async function () {
    expect(await secondaryMarket.getAddress()).to.not.equal(ethers.ZeroAddress);
    expect(await secondaryMarketWithRouter.getAddress()).to.not.equal(ethers.ZeroAddress);
  });

  it("Set initial router correctly", async function () {
    expect(await secondaryMarket.router()).to.equal(ethers.ZeroAddress);
    expect(await secondaryMarketWithRouter.router()).to.equal(router);
  });

  it("Should be able to execute matching intents", async function () {
    const { buyerIntent, buyerSignature, sellerIntent, sellerSignature } = await createMatchingIntents();

    await secondaryMarket.verifyPriceMatch(sellerIntent, buyerIntent);

    const tradedAmount = await secondaryMarket.executableTrade(sellerIntent, buyerIntent);
    const totalExecutionPrice = await secondaryMarket.getTotalExecutionPrice(sellerIntent, buyerIntent, tradedAmount);
    const tradingFeeBips = await secondaryMarket.tradingFeeBips();
    const totalFee = totalExecutionPrice * tradingFeeBips / 10000n;

    const buyerCurrencyBefore = await zchf.balanceOf(buyerIntentConfig.owner);
    const buyerTokenBefore = await sharesUnderAgreement.balanceOf(buyerIntentConfig.owner);
    const buyerFilledAmountBefore = await secondaryMarket.getFilledAmount(buyerIntent);
    const sellerCurrencyBefore = await zchf.balanceOf(sellerIntentConfig.owner);
    const sellerTokenBefore = await sharesUnderAgreement.balanceOf(sellerIntentConfig.owner);
    const sellerFilledAmountBefore = await secondaryMarket.getFilledAmount(sellerIntent);
    const marketCurrencyBefore = await zchf.balanceOf(await secondaryMarket.getAddress());

    await secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount);
    
    const buyerCurrencyAfter = await zchf.balanceOf(buyerIntentConfig.owner);
    const buyerTokenAfter = await sharesUnderAgreement.balanceOf(buyerIntentConfig.owner);
    const buyerFilledAmountAfter = await secondaryMarket.getFilledAmount(buyerIntent);
    const sellerCurrencyAfter = await zchf.balanceOf(sellerIntentConfig.owner);
    const sellerTokenAfter = await sharesUnderAgreement.balanceOf(sellerIntentConfig.owner);
    const sellerFilledAmountAfter = await secondaryMarket.getFilledAmount(sellerIntent);
    const marketCurrencyAfter = await zchf.balanceOf(await secondaryMarket.getAddress());

    expect(buyerTokenAfter - buyerTokenBefore).to.equal(tradedAmount);
    expect(sellerTokenBefore - sellerTokenAfter).to.equal(tradedAmount);
    expect(buyerCurrencyBefore - buyerCurrencyAfter).to.equal(totalExecutionPrice);
    expect(sellerCurrencyAfter - sellerCurrencyBefore).to.equal(totalExecutionPrice - totalFee);
    expect(marketCurrencyAfter - marketCurrencyBefore).to.equal(totalFee);
    expect(buyerFilledAmountAfter - buyerFilledAmountBefore).to.equal(tradedAmount);
    expect(sellerFilledAmountAfter - sellerFilledAmountBefore).to.equal(tradedAmount);
  });

  it("Should be able to process intent with same parameters created on different timestamps", async function () {
    const buyerIntent1 = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature1 = await getSignature(signer1, buyerIntent1, await secondaryMarket.getAddress());    
    const sellerIntent1 = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature1 = await getSignature(signer2, sellerIntent1, await secondaryMarket.getAddress());
    const tradedAmount1 = await secondaryMarket.executableTrade(sellerIntent1, buyerIntent1);

    await connection.networkHelpers.mine();

    const buyerIntent2 = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature2 = await getSignature(signer1, buyerIntent2, await secondaryMarket.getAddress());    
    const sellerIntent2 = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature2 = await getSignature(signer2, sellerIntent2, await secondaryMarket.getAddress());
    const tradedAmount2 = await secondaryMarket.executableTrade(sellerIntent2, buyerIntent2);

    await expect(secondaryMarket.process(sellerIntent1, sellerSignature1, buyerIntent1, buyerSignature1, tradedAmount1)).to.not.revert(ethers);
    await expect(secondaryMarket.process(sellerIntent2, sellerSignature2, buyerIntent2, buyerSignature2, tradedAmount2)).to.not.revert(ethers);
  });

  it("Should not be able to execute same intents twice - One would be OverFilled", async function () {
    const { buyerIntent, buyerSignature, sellerIntent, sellerSignature } = await createMatchingIntents();
    const tradedAmount = await secondaryMarket.executableTrade(sellerIntent, buyerIntent);

    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount)).to.not.revert(ethers);
    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount)).to.revert(ethers);
  });

  it("Should be able to match one intent against multiple other intents at different prices until fully filled, and not more.", async function () {
    // Seller selling 100 tokens for 10 ZCHF each
    const sellerAmountTokens = ethers.parseUnits("100", 0);
    const sellerAmountZCHF = ethers.parseUnits("1000", 18);
    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(signer2, sellerAmountTokens, sellerAmountZCHF, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await secondaryMarket.getAddress());
    var sellerRemainingBalance = await sharesUnderAgreement.balanceOf(signer2.address);

    // Buyer 1 offering to buy 50 tokens for 10 ZCHF each
    const buyer1AmountTokens = ethers.parseUnits("50", 0);
    const buyer1AmountZCHF = ethers.parseUnits("500", 18);
    const buyer1Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer1, buyer1AmountZCHF, buyer1AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer1Signature = await getSignature(signer1, buyer1Intent, await secondaryMarket.getAddress());

    // Buyer 2 offering to buy 30 tokens for 12 ZCHF each
    const buyer2AmountTokens = ethers.parseUnits("30", 0);
    const buyer2AmountZCHF = ethers.parseUnits("360", 18);
    const buyer2Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer3,buyer2AmountZCHF,  buyer2AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer2Signature = await getSignature(signer3, buyer2Intent, await secondaryMarket.getAddress());

    // Buyer 3 offering to buy 40 tokens for 15 ZCHF each
    const buyer3AmountTokens = ethers.parseUnits("40", 0);
    const buyer3AmountZCHF = ethers.parseUnits("600", 18);
    const buyer3Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer4,  buyer3AmountZCHF,buyer3AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer3Signature = await getSignature(signer4, buyer3Intent, await secondaryMarket.getAddress());

    // Buyer 4 offering to buy 50 tokens for 9 ZCHF each, which should not match
    const buyer4AmountTokens = ethers.parseUnits("50", 0);
    const buyer4AmountZCHF = ethers.parseUnits("450", 18);
    const buyer4Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer5, buyer4AmountZCHF,buyer4AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer4Signature = await getSignature(signer5, buyer4Intent, await secondaryMarket.getAddress());

    // All intents created on the same block. //

    // Seller - Buyer 4 should not match because price is too low
    await expect(secondaryMarket.verifyPriceMatch(sellerIntent, buyer4Intent)).to.revert(ethers);
    await expect(secondaryMarket.executableTrade(sellerIntent, buyer4Intent)).to.revert(ethers);
    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyer4Intent, buyer4Signature, 1)).to.revert(ethers);

    // Seller - Buyer 1 should match for full 50 tokens
    const tradeAmount1 = await secondaryMarket.executableTrade(sellerIntent, buyer1Intent);
    expect(tradeAmount1).to.equal(50);
    expect(await secondaryMarket.process(sellerIntent, sellerSignature, buyer1Intent, buyer1Signature, 50)).to.not.revert(ethers);
    expect(await secondaryMarket.getFilledAmount(sellerIntent)).to.equal(50);
    expect(await secondaryMarket.getFilledAmount(buyer1Intent)).to.equal(50);
    expect(await sharesUnderAgreement.balanceOf(signer2.address)).to.equal(sellerRemainingBalance - tradeAmount1);
    sellerRemainingBalance -= tradeAmount1;

    // Seller - Buyer 2 should match for full 30 tokens
    const tradeAmount2 = await secondaryMarket.executableTrade(sellerIntent, buyer2Intent);
    expect(tradeAmount2).to.equal(30);
    expect(await secondaryMarket.process(sellerIntent, sellerSignature, buyer2Intent, buyer2Signature, 30)).to.not.revert(ethers);
    expect(await secondaryMarket.getFilledAmount(sellerIntent)).to.equal(80);
    expect(await secondaryMarket.getFilledAmount(buyer2Intent)).to.equal(30);
    expect(await sharesUnderAgreement.balanceOf(signer2.address)).to.equal(sellerRemainingBalance - tradeAmount2);
    sellerRemainingBalance -= tradeAmount2;

    // Seller - Buyer 3 should match for remaining 20 tokens, not full 40
    const tradeAmount3 = await secondaryMarket.executableTrade(sellerIntent, buyer3Intent);
    expect(tradeAmount3).to.equal(20);
    expect(await secondaryMarket.process(sellerIntent, sellerSignature, buyer3Intent, buyer3Signature, 20)).to.not.revert(ethers);
    expect(await secondaryMarket.getFilledAmount(sellerIntent)).to.equal(100);
    expect(await secondaryMarket.getFilledAmount(buyer3Intent)).to.equal(20);
    expect(await sharesUnderAgreement.balanceOf(signer2.address)).to.equal(sellerRemainingBalance - tradeAmount3);
  });

  describe("Token pair check in process", function () {
    // An intent is bound to this market by its signature, but its tokens still have to be this market's
    // pair, and in the right slot: the seller gives TOKEN, the buyer gives CURRENCY.
    async function routerlessIntent(signer: any, tokenOut: any, amountOut: bigint, tokenIn: any, amountIn: bigint) {
      const now = BigInt((await provider.request({ method: "eth_getBlockByNumber", params: ["latest", false] }) as any).timestamp);
      const intent = {
        owner: signer.address, router: ethers.ZeroAddress,
        tokenOut: await ethers.resolveAddress(tokenOut), amountOut,
        tokenIn: await ethers.resolveAddress(tokenIn), amountIn,
        creation: now, expiration: now + 3600n, data: "0x",
      };
      return { intent, signature: await getSignature(signer, intent, await secondaryMarket.getAddress()) };
    }

    it("settles router-less intents for its own pair", async function () {
      const seller = await routerlessIntent(signer2, sharesUnderAgreement, 20n, zchf, ethers.parseUnits("150", 18));
      const buyer = await routerlessIntent(signer1, zchf, ethers.parseUnits("100", 18), sharesUnderAgreement, 10n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n))
        .to.emit(secondaryMarket, "Trade");
    });

    it("rejects intents trading another token", async function () {
      const Shares = await ethers.getContractFactory("contracts/shares/base/Shares.sol:Shares");
      const other = await Shares.deploy("OTH", "Other Shares", "https://test.com/terms", owner);
      await other.connect(owner).mint(signer2.address, 20n);
      await other.connect(signer2).approve(secondaryMarket, 20n);

      const seller = await routerlessIntent(signer2, other, 20n, zchf, ethers.parseUnits("150", 18));
      const buyer = await routerlessIntent(signer1, zchf, ethers.parseUnits("100", 18), other, 10n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");
    });

    it("rejects intents trading against another currency", async function () {
      const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      const seller = await routerlessIntent(signer2, sharesUnderAgreement, 20n, usdt, 150_000_000n);
      const buyer = await routerlessIntent(signer1, usdt, 100_000_000n, sharesUnderAgreement, 10n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");
    });

    it("rejects seller and buyer intents passed in swapped positions", async function () {
      const { buyerIntent, buyerSignature, sellerIntent, sellerSignature } = await createMatchingIntents();
      await expect(secondaryMarket.process(buyerIntent, buyerSignature, sellerIntent, sellerSignature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");
    });
  });

  it("Should not execute expired intents", async function () {
    const buyerIntent = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature = await getSignature(signer1, buyerIntent, await secondaryMarket.getAddress());    

    // Pass the time
    connection.networkHelpers.time.increase(buyerIntentConfig.validitySeconds + 1);

    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await secondaryMarket.getAddress());
    const tradedAmount = await secondaryMarket.executableTrade(sellerIntent, buyerIntent);

    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount)).to.be.revertedWithCustomError(secondaryMarket, "IntentExpired");
  });

  it("Should return immediately executable part of sell intents", async function () {
    // Assign 100 shares to seller
    await mintAndWrap(shares, sharesUnderAgreement, signer6.address, ethers.parseUnits("100", 0));

    // Seller intent to sell 100 shares for 100 ZCHF, valid for 1 hour
    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(signer6, ethers.parseUnits("100", 0), ethers.parseUnits("100", 18), 3600));
    
    // First give full approval
    var allowance = ethers.parseUnits("100000", 0);
    await sharesUnderAgreement.connect(signer6).approve(secondaryMarket, allowance);
    var available = await secondaryMarket.executableAmount(sellerIntent);
    expect(available).to.equal(ethers.parseUnits("100", 0));

    // Then reduce balance
    await sharesUnderAgreement.connect(signer6).transfer(signer1.address, ethers.parseUnits("50", 0));
    var available = await secondaryMarket.executableAmount(sellerIntent);
    expect(available).to.equal(ethers.parseUnits("50", 0));

    // Then reduce allowance
    var allowance = ethers.parseUnits("10", 0);
    await sharesUnderAgreement.connect(signer6).approve(secondaryMarket, allowance);
    var available = await secondaryMarket.executableAmount(sellerIntent);
    expect(available).to.equal(ethers.parseUnits("10", 0));

    // Does not check partially filled cases. Maybe to do later, maybe assume they are working.
  });

  it("Should return immediately executable part of buy intents", async function () {
    // Assign 100 ZCHF to buyer
    await setZCHFBalance(signer7.address, ethers.parseUnits("100", 18));

    // Buyer intent to sell 100 shares for 100 ZCHF, valid for 1 hour
    const buyerIntent = getNamedStruct(await secondaryMarket.createBuyOrder(signer7, ethers.parseUnits("100", 18), ethers.parseUnits("100", 0), 3600));
    
    // First give full approval
    var allowance = ethers.parseUnits("100000", 18);
    await zchf.connect(signer7).approve(secondaryMarket, allowance);
    var available = await secondaryMarket.executableAmount(buyerIntent);
    expect(available).to.equal(ethers.parseUnits("100", 0));

    // Then reduce balance
    await zchf.connect(signer7).transfer(signer1.address, ethers.parseUnits("50", 18));
    var available = await secondaryMarket.executableAmount(buyerIntent);
    expect(available).to.equal(ethers.parseUnits("50", 0));

    // Then reduce allowance
    var allowance = ethers.parseUnits("10", 18);
    await zchf.connect(signer7).approve(secondaryMarket, allowance);
    var available = await secondaryMarket.executableAmount(buyerIntent);
    expect(available).to.equal(ethers.parseUnits("10", 0));
  });

  describe("Intent hardening (audit #1, #3, #5, #10)", function () {
    // Router-less intents signed for this market, built by hand so every field can be chosen.
    async function signedIntent(signer: any, tokenOut: any, amountOut: bigint, tokenIn: any, amountIn: bigint, overrides: any = {}) {
      const now = BigInt(await connection.networkHelpers.time.latest());
      const intent = {
        owner: signer.address, router: ethers.ZeroAddress,
        tokenOut: await ethers.resolveAddress(tokenOut), amountOut,
        tokenIn: await ethers.resolveAddress(tokenIn), amountIn,
        creation: now, expiration: now + 3600n, data: "0x",
        ...overrides,
      };
      return { intent, signature: await getSignature(signer, intent, await secondaryMarket.getAddress()) };
    }

    it("computes the fee itself, whoever submits the match, and keeps it (#1)", async function () {
      const seller = await signedIntent(signer2, sharesUnderAgreement, 20n, zchf, ethers.parseUnits("150", 18));
      const buyer = await signedIntent(signer1, zchf, ethers.parseUnits("100", 18), sharesUnderAgreement, 10n);
      const price = await secondaryMarket.getTotalExecutionPrice(seller.intent, buyer.intent, 10n);
      const fee = price * (await secondaryMarket.tradingFeeBips()) / 10000n;
      expect(fee).to.be.greaterThan(0n);

      const strangerBefore = await zchf.balanceOf(signer3.address);
      const marketBefore = await zchf.balanceOf(secondaryMarket);
      const sellerBefore = await zchf.balanceOf(signer2.address);
      // the market has no router and the intents name none, so a stranger may submit the match; it earns nothing by doing so
      await expect(secondaryMarket.connect(signer3).process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n))
        .to.emit(secondaryMarket, "Trade").withArgs(signer2.address, signer1.address, await secondaryMarket.getIntentHash(seller.intent), await secondaryMarket.getIntentHash(buyer.intent), sharesUnderAgreement, 10n, zchf, price, fee);
      expect(await zchf.balanceOf(signer3.address)).to.equal(strangerBefore);
      expect((await zchf.balanceOf(secondaryMarket)) - marketBefore).to.equal(fee);
      expect((await zchf.balanceOf(signer2.address)) - sellerBefore).to.equal(price - fee);
    });

    it("caps the trading fee at 5% (#1, #10)", async function () {
      expect(await secondaryMarket.MAX_TRADING_FEE_BIPS()).to.equal(500n);
      await expect(secondaryMarket.connect(owner).setTradingFee(501)).to.be.revertedWithCustomError(secondaryMarket, "InvalidConfiguration");
      await secondaryMarket.connect(owner).setTradingFee(500);
      expect(await secondaryMarket.tradingFeeBips()).to.equal(500n);
      await secondaryMarket.connect(owner).setTradingFee(190);
    });

    it("rejects a filled sell intent in the buyer slot, so it cannot be filled again in currency units (#3)", async function () {
      // The auditor's PoC: a sell intent for 10 shares, honestly filled, then passed in the buyer slot where the
      // reactor used to read its cap from amountIn (900e18 currency) instead of amountOut (10 shares).
      const victimSell = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("900", 18));
      const honestBuy = await signedIntent(signer1, zchf, ethers.parseUnits("900", 18), sharesUnderAgreement, 10n);
      await secondaryMarket.process(victimSell.intent, victimSell.signature, honestBuy.intent, honestBuy.signature, 10n);
      expect(await secondaryMarket.getFilledAmount(victimSell.intent)).to.equal(10n);

      // attacker "sells" currency with amountIn = 0 so that the ask is zero
      const attack = await signedIntent(signer3, zchf, ethers.parseUnits("810", 18), sharesUnderAgreement, 0n);
      await expect(secondaryMarket.connect(signer3).process(attack.intent, attack.signature, victimSell.intent, victimSell.signature, ethers.parseUnits("90", 18)))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");
      // the dust variant that used to mark the intent as filled without moving shares
      const dust = await signedIntent(signer3, zchf, 10n, sharesUnderAgreement, 0n);
      await expect(secondaryMarket.connect(signer3).process(dust.intent, dust.signature, victimSell.intent, victimSell.signature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");
      expect(await secondaryMarket.getFilledAmount(victimSell.intent)).to.equal(10n);
    });

    it("rejects a buy intent in the seller slot (#3)", async function () {
      const victimBuy = await signedIntent(signer1, zchf, 10n, sharesUnderAgreement, 10n);
      const attack = await signedIntent(signer3, sharesUnderAgreement, 20n, zchf, 10n);
      await expect(secondaryMarket.connect(signer3).process(victimBuy.intent, victimBuy.signature, attack.intent, attack.signature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");
    });

    it("never fills beyond the signed maximum and reports OverFilled, also once cancelled (#3)", async function () {
      const seller = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("900", 18));
      const buyerA = await signedIntent(signer1, zchf, ethers.parseUnits("450", 18), sharesUnderAgreement, 5n);
      const buyerB = await signedIntent(signer3, zchf, ethers.parseUnits("540", 18), sharesUnderAgreement, 6n);
      await secondaryMarket.process(seller.intent, seller.signature, buyerA.intent, buyerA.signature, 5n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyerB.intent, buyerB.signature, 6n))
        .to.be.revertedWithCustomError(secondaryMarket, "OverFilled");
      await secondaryMarket.process(seller.intent, seller.signature, buyerB.intent, buyerB.signature, 5n);
      expect(await secondaryMarket.getFilledAmount(seller.intent)).to.equal(10n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyerB.intent, buyerB.signature, 1n))
        .to.be.revertedWithCustomError(secondaryMarket, "OverFilled");

      // a cancelled intent reverts with OverFilled instead of an arithmetic panic
      await secondaryMarket.connect(signer3).cancelIntent(buyerB.intent);
      expect(await secondaryMarket.getFilledAmount(buyerB.intent)).to.equal(await secondaryMarket.CANCELLED());
      const buyerC = await signedIntent(signer3, zchf, ethers.parseUnits("90", 18), sharesUnderAgreement, 1n);
      const sellerD = await signedIntent(signer2, sharesUnderAgreement, 1n, zchf, ethers.parseUnits("90", 18));
      await expect(secondaryMarket.process(sellerD.intent, sellerD.signature, buyerB.intent, buyerB.signature, 1n))
        .to.be.revertedWithCustomError(secondaryMarket, "OverFilled");
      await expect(secondaryMarket.validateOrder(buyerB.intent, buyerB.signature)).to.be.revertedWithCustomError(secondaryMarket, "UserCancelled");
      await secondaryMarket.process(sellerD.intent, sellerD.signature, buyerC.intent, buyerC.signature, 1n);
    });

    it("rejects intents created in the future and accepts creation equal to the block time (#5)", async function () {
      const now = BigInt(await connection.networkHelpers.time.latest());
      const seller = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("900", 18), { creation: now + 1000n, expiration: now + 4600n });
      const buyer = await signedIntent(signer1, zchf, ethers.parseUnits("900", 18), sharesUnderAgreement, 10n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "IntentFromTheFuture").withArgs(now + 1000n);
      await expect(secondaryMarket.placeOrder(seller.intent, seller.signature))
        .to.be.revertedWithCustomError(secondaryMarket, "IntentFromTheFuture").withArgs(now + 1000n);

      // settles in the block whose timestamp equals the creation time
      await connection.networkHelpers.time.setNextBlockTimestamp(now + 1000n);
      await expect(secondaryMarket.process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n)).to.emit(secondaryMarket, "Trade");
    });

    it("binds an intent to the market it was signed for", async function () {
      const { buyerIntent, buyerSignature, sellerIntent, sellerSignature } = await createMatchingIntents();
      // same token, same currency, different market: the signature does not verify there
      await expect(secondaryMarketWithRouter.connect(router).process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, 10n))
        .to.be.revertedWithCustomError(secondaryMarketWithRouter, "InvalidSigner");
    });

    it("enforces the configured router", async function () {
      const marketAddress = await secondaryMarketWithRouter.getAddress();
      const now = BigInt(await connection.networkHelpers.time.latest());
      const common = { router: ethers.ZeroAddress, creation: now, expiration: now + 3600n, data: "0x" };
      const seller = { ...common, owner: signer2.address, tokenOut: await sharesUnderAgreement.getAddress(), amountOut: 10n, tokenIn: await zchf.getAddress(), amountIn: ethers.parseUnits("100", 18) };
      const buyer = { ...common, owner: signer1.address, tokenOut: await zchf.getAddress(), amountOut: ethers.parseUnits("100", 18), tokenIn: await sharesUnderAgreement.getAddress(), amountIn: 10n };
      const sellerSig = await getSignature(signer2, seller, marketAddress);
      const buyerSig = await getSignature(signer1, buyer, marketAddress);
      await sharesUnderAgreement.connect(signer2).approve(secondaryMarketWithRouter, 10n);
      await zchf.connect(signer1).approve(secondaryMarketWithRouter, ethers.parseUnits("100", 18));

      await expect(secondaryMarketWithRouter.connect(signer3).process(seller, sellerSig, buyer, buyerSig, 10n))
        .to.be.revertedWithCustomError(secondaryMarketWithRouter, "WrongRouter").withArgs(router.address, signer3.address);
      await expect(secondaryMarketWithRouter.connect(router).process(seller, sellerSig, buyer, buyerSig, 10n)).to.emit(secondaryMarketWithRouter, "Trade");
    });

    it("lets only the named router submit an intent that names one", async function () {
      const seller = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("100", 18), { router: signer3.address });
      const buyer = await signedIntent(signer1, zchf, ethers.parseUnits("100", 18), sharesUnderAgreement, 10n);
      await expect(secondaryMarket.connect(deployer).process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n))
        .to.be.revertedWithCustomError(secondaryMarket, "WrongRouter");
      await expect(secondaryMarket.connect(signer3).process(seller.intent, seller.signature, buyer.intent, buyer.signature, 10n)).to.emit(secondaryMarket, "Trade");
    });

    it("lets the intent owner, the intent router, the market router and the market owner cancel, nobody else", async function () {
      const now = BigInt(await connection.networkHelpers.time.latest());
      const base = { owner: signer2.address, tokenOut: await sharesUnderAgreement.getAddress(), amountOut: 10n, tokenIn: await zchf.getAddress(), amountIn: ethers.parseUnits("100", 18), creation: now, expiration: now + 3600n };
      const intents = [0n, 1n, 2n, 3n].map(i => ({ ...base, router: signer3.address, data: ethers.toBeHex(i, 1) }));
      const market = secondaryMarketWithRouter;
      await expect(market.connect(signer4).cancelIntent(intents[0])).to.be.revertedWithCustomError(market, "NotAuthorized");
      await market.connect(signer2).cancelIntent(intents[0]); // owner
      await market.connect(signer3).cancelIntent(intents[1]); // intent router
      await market.connect(router).cancelIntent(intents[2]); // market router
      await market.connect(owner).cancelIntent(intents[3]); // market owner
      for (const intent of intents) {
        expect(await market.getFilledAmount(intent)).to.equal(await market.CANCELLED());
      }
      // cancel by anyone on the router-less market is still refused
      await expect(secondaryMarket.connect(signer4).cancelIntent({ ...intents[0], router: ethers.ZeroAddress }))
        .to.be.revertedWithCustomError(secondaryMarket, "NotAuthorized");
    });

    it("rejects a zero-amount trade", async function () {
      const { buyerIntent, buyerSignature, sellerIntent, sellerSignature } = await createMatchingIntents();
      await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, 0n))
        .to.be.revertedWithCustomError(secondaryMarket, "NothingToTrade");
    });

    it("order-book views never revert on degenerate or foreign intents", async function () {
      const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      const foreign = (await signedIntent(signer2, sharesUnderAgreement, 20n, usdt, 150_000_000n)).intent;
      const buyNothing = (await signedIntent(signer1, zchf, ethers.parseUnits("100", 18), sharesUnderAgreement, 0n)).intent;
      const buyBelowOneUnit = (await signedIntent(signer1, zchf, 5n, sharesUnderAgreement, 10n)).intent;
      const sellNothing = (await signedIntent(signer2, sharesUnderAgreement, 0n, zchf, ethers.parseUnits("100", 18))).intent;
      const sellValid = (await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("100", 18))).intent;
      const amounts = await secondaryMarket.executableAmounts([foreign, buyNothing, buyBelowOneUnit, sellNothing, sellValid]);
      expect(amounts).to.deep.equal([0n, 0n, 0n, 0n, 10n]);
      expect(await secondaryMarket.executableTrade(sellNothing, buyNothing)).to.equal(0n);
      expect(await secondaryMarket.executableTrade(sellValid, buyNothing)).to.equal(0n);
      // process still rejects them: the fill cap is zero
      const sig = await getSignature(signer2, sellNothing, await secondaryMarket.getAddress());
      const buyer = await signedIntent(signer1, zchf, ethers.parseUnits("100", 18), sharesUnderAgreement, 10n);
      await expect(secondaryMarket.process(sellNothing, sig, buyer.intent, buyer.signature, 1n))
        .to.be.revertedWithCustomError(secondaryMarket, "OverFilled");
    });

    it("publishes only orders that validate", async function () {
      const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      const foreign = await signedIntent(signer2, sharesUnderAgreement, 20n, usdt, 150_000_000n);
      await expect(secondaryMarket.placeOrder(foreign.intent, foreign.signature)).to.be.revertedWithCustomError(secondaryMarket, "WrongTokens");

      const sell = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("100", 18));
      await expect(secondaryMarket.placeOrder(sell.intent, sell.signature))
        .to.emit(secondaryMarket, "IntentSignal").withArgs(signer2.address, ethers.ZeroAddress, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("100", 18), sell.intent.creation, sell.intent.expiration, "0x", sell.signature);
      const buy = await signedIntent(signer1, zchf, ethers.parseUnits("100", 18), sharesUnderAgreement, 10n);
      await secondaryMarket.process(sell.intent, sell.signature, buy.intent, buy.signature, 10n);
      await expect(secondaryMarket.placeOrder(sell.intent, sell.signature)).to.be.revertedWithCustomError(secondaryMarket, "AlreadyFilled");

      const cancelled = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("101", 18));
      await secondaryMarket.connect(signer2).cancelIntent(cancelled.intent);
      await expect(secondaryMarket.placeOrder(cancelled.intent, cancelled.signature)).to.be.revertedWithCustomError(secondaryMarket, "UserCancelled");
      const bad = await signedIntent(signer2, sharesUnderAgreement, 10n, zchf, ethers.parseUnits("102", 18));
      await expect(secondaryMarket.placeOrder(bad.intent, buy.signature)).to.be.revertedWithCustomError(secondaryMarket, "InvalidSigner");
    });

    it("prices exactly: ceiling ask, floor bid, equal prices match, later side at most one unit worse", async function () {
      const tenChf = ethers.parseUnits("10", 18);
      // 7 shares for 10 CHF on both sides: 10e18 is not divisible by 7
      const sell = await signedIntent(signer2, sharesUnderAgreement, 7n, zchf, tenChf);
      const buy = await signedIntent(signer1, zchf, tenChf, sharesUnderAgreement, 7n);
      expect(await secondaryMarket.getAsk(sell.intent, 3n)).to.equal((tenChf * 3n + 6n) / 7n); // rounded up
      expect(await secondaryMarket.getBid(buy.intent, 3n)).to.equal(tenChf * 3n / 7n);          // rounded down
      expect(await secondaryMarket.getAsk(sell.intent, 0n)).to.equal(0n);
      expect(await secondaryMarket.getAsk(sell.intent, 7n)).to.equal(tenChf);
      await secondaryMarket.verifyPriceMatch(sell.intent, buy.intent); // one-unit rounding used to make this revert
      // same creation: the seller counts as later, the buyer's floor price applies, seller one wei short of exact
      expect(await secondaryMarket.getTotalExecutionPrice(sell.intent, buy.intent, 3n)).to.equal(tenChf * 3n / 7n);
      await expect(secondaryMarket.process(sell.intent, sell.signature, buy.intent, buy.signature, 3n)).to.emit(secondaryMarket, "Trade");
      // one wei below the ask on the whole intent does not match
      const cheap = await signedIntent(signer1, zchf, tenChf - 1n, sharesUnderAgreement, 7n);
      await expect(secondaryMarket.verifyPriceMatch(sell.intent, cheap.intent)).to.be.revertedWithCustomError(secondaryMarket, "OfferTooLow");
      await expect(secondaryMarket.process(sell.intent, sell.signature, cheap.intent, cheap.signature, 1n)).to.be.revertedWithCustomError(secondaryMarket, "OfferTooLow");
    });

    it("withdraws the accumulated fees with the license split", async function () {
      const balance = await zchf.balanceOf(secondaryMarket);
      expect(balance).to.be.greaterThan(0n);
      const split = balance * (await secondaryMarket.licenseShare()) / 10000n;
      const licensee = await secondaryMarket.LICENSE_FEE_RECIPIENT();
      const ownerBefore = await zchf.balanceOf(owner.address);
      const licenseeBefore = await zchf.balanceOf(licensee);
      await expect(secondaryMarket.connect(signer1)["withdrawFees()"]()).to.be.revertedWithCustomError(secondaryMarket, "Ownable_NotOwner");
      await expect(secondaryMarket.connect(owner)["withdrawFees()"]())
        .to.emit(secondaryMarket, "TradingFeeWithdrawn").withArgs(zchf, owner.address, balance - split)
        .and.to.emit(secondaryMarket, "LicenseFeePaid").withArgs(zchf, licensee, split);
      expect((await zchf.balanceOf(owner.address)) - ownerBefore).to.equal(balance - split);
      expect((await zchf.balanceOf(licensee)) - licenseeBefore).to.equal(split);
      expect(await zchf.balanceOf(secondaryMarket)).to.equal(0n);
    });
  });

});
