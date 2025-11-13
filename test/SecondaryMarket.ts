import { expect } from "chai";
import { Contract, MaxInt256 } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5, signer6, signer7 } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";
import { buyerIntentConfig, getNamedStruct, getSignature, sellerIntentConfig } from "./Intent.ts";
import { setZCHFBalance } from "../scripts/helpers/setBalance.ts";
import { mintAndWrap } from "../scripts/helpers/mintAndWrap.ts";
import { AllowlistDraggableShares, AllowlistShares, IERC20, SecondaryMarket, SecondaryMarketFactory, TradeReactor } from "../types/ethers-contracts/index.ts";


describe("SecondaryMarket", function () {
  let tradeReactor: TradeReactor;
  let secondaryMarketFactory: SecondaryMarketFactory;
  let secondaryMarket: SecondaryMarket;
  let secondaryMarketWithRouter: SecondaryMarket;
  let allowlistShares: AllowlistShares
  let allowlistDraggableShares: AllowlistDraggableShares
  let zchf: IERC20;
  const router = deployer; // Use an existing signer as router

  async function deployTestModuleFixture() {
    return connection.ignition.deploy(TestModule);
  }

  // Convenience method to create 2 matching intents for testing
  // Calling this on the same block should return the same intents
  // Whereas calling it after a transaction or manual mining should return new, different intents
  async function createMatchingIntents() {
    const buyerIntent = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature = await getSignature(signer1, buyerIntent, await tradeReactor.getAddress());    
    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await tradeReactor.getAddress());
    return { buyerIntent, buyerSignature, sellerIntent, sellerSignature }
  }

  before(async function() {
    ({ secondaryMarketFactory, zchf, allowlistShares, allowlistDraggableShares, tradeReactor } = await connection.networkHelpers.loadFixture(deployTestModuleFixture));

    const secondaryMarketAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress);
    await secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress);
    secondaryMarket = await ethers.getContractAt("SecondaryMarket", secondaryMarketAddress);
    
    const secondaryMarketWithRouterAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, tradeReactor, router);
    await secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, router);
    secondaryMarketWithRouter = await ethers.getContractAt("SecondaryMarket", secondaryMarketWithRouterAddress);

    // Set balances and allowances of buyer and seller
    await setZCHFBalance(signer1.address, ethers.parseUnits("100000", 18));
    await setZCHFBalance(signer3.address, ethers.parseUnits("100000", 18));
    await setZCHFBalance(signer4.address, ethers.parseUnits("100000", 18));
    await setZCHFBalance(signer5.address, ethers.parseUnits("100000", 18));
    await zchf.connect(signer1).approve(tradeReactor, ethers.parseUnits("100000", 18));
    await zchf.connect(signer3).approve(tradeReactor, ethers.parseUnits("100000", 18));
    await zchf.connect(signer4).approve(tradeReactor, ethers.parseUnits("100000", 18));
    await zchf.connect(signer5).approve(tradeReactor, ethers.parseUnits("100000", 18));
    await mintAndWrap(allowlistShares, allowlistDraggableShares, signer2.address, ethers.parseUnits("1000", 0));
    await allowlistDraggableShares.connect(signer2).approve(tradeReactor, ethers.parseUnits("100000", 0));
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

    await tradeReactor.verifyPriceMatch(buyerIntent, sellerIntent);

    const tradedAmount = await tradeReactor.getMaxValidAmount(sellerIntent, buyerIntent);
    const totalExecutionPrice = await tradeReactor.getTotalExecutionPrice(buyerIntent, sellerIntent, tradedAmount);
    const tradingFeeBips = await secondaryMarket.tradingFeeBips();
    const totalFee = totalExecutionPrice * tradingFeeBips / 10000n;

    const buyerCurrencyBefore = await zchf.balanceOf(buyerIntentConfig.owner);
    const buyerTokenBefore = await allowlistDraggableShares.balanceOf(buyerIntentConfig.owner);
    const buyerFilledAmountBefore = await tradeReactor.getFilledAmount(buyerIntent);
    const sellerCurrencyBefore = await zchf.balanceOf(sellerIntentConfig.owner);
    const sellerTokenBefore = await allowlistDraggableShares.balanceOf(sellerIntentConfig.owner);
    const sellerFilledAmountBefore = await tradeReactor.getFilledAmount(sellerIntent);
    const fillerCurrencyBefore = await zchf.balanceOf(await secondaryMarket.getAddress());

    await secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount);
    
    const buyerCurrencyAfter = await zchf.balanceOf(buyerIntentConfig.owner);
    const buyerTokenAfter = await allowlistDraggableShares.balanceOf(buyerIntentConfig.owner);
    const buyerFilledAmountAfter = await tradeReactor.getFilledAmount(buyerIntent);
    const sellerCurrencyAfter = await zchf.balanceOf(sellerIntentConfig.owner);
    const sellerTokenAfter = await allowlistDraggableShares.balanceOf(sellerIntentConfig.owner);
    const sellerFilledAmountAfter = await tradeReactor.getFilledAmount(sellerIntent);
    const fillerCurrencyAfter = await zchf.balanceOf(await secondaryMarket.getAddress());

    expect(buyerTokenAfter - buyerTokenBefore).to.equal(tradedAmount);
    expect(sellerTokenBefore - sellerTokenAfter).to.equal(tradedAmount);
    expect(buyerCurrencyBefore - buyerCurrencyAfter).to.equal(totalExecutionPrice);
    expect(sellerCurrencyAfter - sellerCurrencyBefore).to.equal(totalExecutionPrice - totalFee);
    expect(fillerCurrencyAfter - fillerCurrencyBefore).to.equal(totalFee);
    expect(buyerFilledAmountAfter - buyerFilledAmountBefore).to.equal(tradedAmount);
    expect(sellerFilledAmountAfter - sellerFilledAmountBefore).to.equal(tradedAmount);
  });

  it("Should be able to process intent with same parameters created on different timestamps", async function () {
    const buyerIntent1 = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature1 = await getSignature(signer1, buyerIntent1, await tradeReactor.getAddress());    
    const sellerIntent1 = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature1 = await getSignature(signer2, sellerIntent1, await tradeReactor.getAddress());
    const tradedAmount1 = await tradeReactor.getMaxValidAmount(sellerIntent1, buyerIntent1);

    await connection.networkHelpers.mine();

    const buyerIntent2 = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature2 = await getSignature(signer1, buyerIntent2, await tradeReactor.getAddress());    
    const sellerIntent2 = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature2 = await getSignature(signer2, sellerIntent2, await tradeReactor.getAddress());
    const tradedAmount2 = await tradeReactor.getMaxValidAmount(sellerIntent2, buyerIntent2);

    await expect(secondaryMarket.process(sellerIntent1, sellerSignature1, buyerIntent1, buyerSignature1, tradedAmount1)).to.not.revert(ethers);
    await expect(secondaryMarket.process(sellerIntent2, sellerSignature2, buyerIntent2, buyerSignature2, tradedAmount2)).to.not.revert(ethers);
  });

  it("Should not be able to execute same intents twice - One would be OverFilled", async function () {
    const { buyerIntent, buyerSignature, sellerIntent, sellerSignature } = await createMatchingIntents();
    const tradedAmount = await tradeReactor.getMaxValidAmount(sellerIntent, buyerIntent);

    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount)).to.not.revert(ethers);
    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount)).to.revert(ethers);
  });

  it("Should be able to match one intent against multiple other intents at different prices until fully filled, and not more.", async function () {
    // Seller selling 100 tokens for 10 ZCHF each
    const sellerAmountTokens = ethers.parseUnits("100", 0);
    const sellerAmountZCHF = ethers.parseUnits("1000", 18);
    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(signer2, sellerAmountTokens, sellerAmountZCHF, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await tradeReactor.getAddress());
    var sellerRemainingBalance = await allowlistDraggableShares.balanceOf(signer2.address);

    // Buyer 1 offering to buy 50 tokens for 10 ZCHF each
    const buyer1AmountTokens = ethers.parseUnits("50", 0);
    const buyer1AmountZCHF = ethers.parseUnits("500", 18);
    const buyer1Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer1, buyer1AmountZCHF, buyer1AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer1Signature = await getSignature(signer1, buyer1Intent, await tradeReactor.getAddress());

    // Buyer 2 offering to buy 30 tokens for 12 ZCHF each
    const buyer2AmountTokens = ethers.parseUnits("30", 0);
    const buyer2AmountZCHF = ethers.parseUnits("360", 18);
    const buyer2Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer3,buyer2AmountZCHF,  buyer2AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer2Signature = await getSignature(signer3, buyer2Intent, await tradeReactor.getAddress());

    // Buyer 3 offering to buy 40 tokens for 15 ZCHF each
    const buyer3AmountTokens = ethers.parseUnits("40", 0);
    const buyer3AmountZCHF = ethers.parseUnits("600", 18);
    const buyer3Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer4,  buyer3AmountZCHF,buyer3AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer3Signature = await getSignature(signer4, buyer3Intent, await tradeReactor.getAddress());

    // Buyer 4 offering to buy 50 tokens for 9 ZCHF each, which should not match
    const buyer4AmountTokens = ethers.parseUnits("50", 0);
    const buyer4AmountZCHF = ethers.parseUnits("450", 18);
    const buyer4Intent = getNamedStruct(await secondaryMarket.createBuyOrder(signer5, buyer4AmountZCHF,buyer4AmountTokens, buyerIntentConfig.validitySeconds));
    const buyer4Signature = await getSignature(signer5, buyer4Intent, await tradeReactor.getAddress());

    // All intents created on the same block. //

    // Seller - Buyer 4 should not match because price is too low
    await expect(tradeReactor.verifyPriceMatch(buyer4Intent, sellerIntent)).to.revert(ethers);
    await expect(tradeReactor.getMaxValidAmount(sellerIntent, buyer4Intent)).to.revert(ethers);
    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyer4Intent, buyer4Signature, 1)).to.revert(ethers);

    // Seller - Buyer 1 should match for full 50 tokens
    const tradeAmount1 = await tradeReactor.getMaxValidAmount(sellerIntent, buyer1Intent);
    expect(tradeAmount1).to.equal(50);
    expect(await secondaryMarket.process(sellerIntent, sellerSignature, buyer1Intent, buyer1Signature, 50)).to.not.revert(ethers);
    expect(await tradeReactor.getFilledAmount(sellerIntent)).to.equal(50);
    expect(await tradeReactor.getFilledAmount(buyer1Intent)).to.equal(50);
    expect(await allowlistDraggableShares.balanceOf(signer2.address)).to.equal(sellerRemainingBalance - tradeAmount1);
    sellerRemainingBalance -= tradeAmount1;

    // Seller - Buyer 2 should match for full 30 tokens
    const tradeAmount2 = await tradeReactor.getMaxValidAmount(sellerIntent, buyer2Intent);
    expect(tradeAmount2).to.equal(30);
    expect(await secondaryMarket.process(sellerIntent, sellerSignature, buyer2Intent, buyer2Signature, 30)).to.not.revert(ethers);
    expect(await tradeReactor.getFilledAmount(sellerIntent)).to.equal(80);
    expect(await tradeReactor.getFilledAmount(buyer2Intent)).to.equal(30);
    expect(await allowlistDraggableShares.balanceOf(signer2.address)).to.equal(sellerRemainingBalance - tradeAmount2);
    sellerRemainingBalance -= tradeAmount2;

    // Seller - Buyer 3 should match for remaining 20 tokens, not full 40
    const tradeAmount3 = await tradeReactor.getMaxValidAmount(sellerIntent, buyer3Intent);
    expect(tradeAmount3).to.equal(20);
    expect(await secondaryMarket.process(sellerIntent, sellerSignature, buyer3Intent, buyer3Signature, 20)).to.not.revert(ethers);
    expect(await tradeReactor.getFilledAmount(sellerIntent)).to.equal(100);
    expect(await tradeReactor.getFilledAmount(buyer3Intent)).to.equal(20);
    expect(await allowlistDraggableShares.balanceOf(signer2.address)).to.equal(sellerRemainingBalance - tradeAmount3);
  });

  it("Should not execute expired intents", async function () {
    const buyerIntent = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature = await getSignature(signer1, buyerIntent, await tradeReactor.getAddress());    

    // Pass the time
    connection.networkHelpers.time.increase(buyerIntentConfig.validitySeconds + 1);

    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await tradeReactor.getAddress());
    const tradedAmount = await tradeReactor.getMaxValidAmount(sellerIntent, buyerIntent);

    await expect(secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount)).to.be.revertedWithCustomError(tradeReactor, "IntentExpired");
  });

  it("Should return immediately executable part of sell intents", async function () {
    // Assign 100 shares to seller
    await mintAndWrap(allowlistShares, allowlistDraggableShares, signer6.address, ethers.parseUnits("100", 0));

    // Seller intent to sell 100 shares for 100 ZCHF, valid for 1 hour
    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(signer6, ethers.parseUnits("100", 0), ethers.parseUnits("100", 18), 3600));
    
    // First give full approval
    var allowance = ethers.parseUnits("100000", 0);
    await allowlistDraggableShares.connect(signer6).approve(tradeReactor, allowance);
    var available = await secondaryMarket.executableAmount(sellerIntent);
    expect(available).to.equal(ethers.parseUnits("100", 0));

    // Then reduce balance
    await allowlistDraggableShares.connect(signer6).transfer(signer1.address, ethers.parseUnits("50", 0));
    var available = await secondaryMarket.executableAmount(sellerIntent);
    expect(available).to.equal(ethers.parseUnits("50", 0));

    // Then reduce allowance
    var allowance = ethers.parseUnits("10", 0);
    await allowlistDraggableShares.connect(signer6).approve(tradeReactor, allowance);
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
    await zchf.connect(signer7).approve(tradeReactor, allowance);
    var available = await secondaryMarket.executableAmount(buyerIntent);
    expect(available).to.equal(ethers.parseUnits("100", 0));

    // Then reduce balance
    await zchf.connect(signer7).transfer(signer1.address, ethers.parseUnits("50", 18));
    var available = await secondaryMarket.executableAmount(buyerIntent);
    expect(available).to.equal(ethers.parseUnits("50", 0));

    // Then reduce allowance
    var allowance = ethers.parseUnits("10", 18);
    await zchf.connect(signer7).approve(tradeReactor, allowance);
    var available = await secondaryMarket.executableAmount(buyerIntent);
    expect(available).to.equal(ethers.parseUnits("10", 0));
  });

});