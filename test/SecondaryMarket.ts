import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";
import { buyerIntentConfig, getEIP712Fields, getNamedStruct, getSignature, sellerIntentConfig } from "./Intent.ts";
import { setZCHFBalance } from "../scripts/helpers/setBalance.ts";
import { mintAndWrap } from "../scripts/helpers/mintAndWrap.ts";


describe("SecondaryMarket", function () {
  let tradeReactor: Contract;
  let secondaryMarketFactory: Contract;
  let secondaryMarket: Contract;
  let secondaryMarketWithRouter: Contract;
  let allowlistShares: Contract
  let allowlistDraggableShares: Contract
  let zchf: Contract;
  const router = signer5; // Use an existing signer as router

  async function deployTestModuleFixture() {
    return connection.ignition.deploy(TestModule);
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
    await setZCHFBalance(signer1.address, ethers.parseUnits("1000", 18));
    await mintAndWrap(allowlistShares, allowlistDraggableShares, signer2.address, ethers.parseUnits("1000", 0));
    await zchf.connect(signer1).approve(tradeReactor, ethers.MaxUint256);
    await allowlistDraggableShares.connect(signer2).approve(tradeReactor, ethers.MaxUint256);
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
    const buyerIntent = getNamedStruct(await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds));
    const buyerSignature = await getSignature(signer1, buyerIntent, await tradeReactor.getAddress());

    const sellerIntent = getNamedStruct(await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds));
    const sellerSignature = await getSignature(signer2, sellerIntent, await tradeReactor.getAddress());

    await tradeReactor.verifyPriceMatch(buyerIntent, sellerIntent);

    const tradedAmount = await tradeReactor.getMaxValidAmount(sellerIntent, buyerIntent);
    const totalExecutionPrice = await tradeReactor.getTotalExecutionPrice(buyerIntent, sellerIntent, tradedAmount);
    const tradingFeeBips = await secondaryMarket.tradingFeeBips();
    const totalFee = totalExecutionPrice * tradingFeeBips / 10000n;

    const buyerCurrencyBefore = await zchf.balanceOf(buyerIntentConfig.owner);
    const buyerTokenBefore = await allowlistDraggableShares.balanceOf(buyerIntentConfig.owner);
    const sellerCurrencyBefore = await zchf.balanceOf(sellerIntentConfig.owner);
    const sellerTokenBefore = await allowlistDraggableShares.balanceOf(sellerIntentConfig.owner);
    const fillerCurrencyBefore = await zchf.balanceOf(await secondaryMarket.getAddress());

    await secondaryMarket.process(sellerIntent, sellerSignature, buyerIntent, buyerSignature, tradedAmount);
    
    const buyerCurrencyAfter = await zchf.balanceOf(buyerIntentConfig.owner);
    const buyerTokenAfter = await allowlistDraggableShares.balanceOf(buyerIntentConfig.owner);
    const sellerCurrencyAfter = await zchf.balanceOf(sellerIntentConfig.owner);
    const sellerTokenAfter = await allowlistDraggableShares.balanceOf(sellerIntentConfig.owner);
    const fillerCurrencyAfter = await zchf.balanceOf(await secondaryMarket.getAddress());

    expect(buyerTokenAfter - buyerTokenBefore).to.equal(tradedAmount);
    expect(sellerTokenBefore - sellerTokenAfter).to.equal(tradedAmount);
    expect(buyerCurrencyBefore - buyerCurrencyAfter).to.equal(totalExecutionPrice);
    expect(sellerCurrencyAfter - sellerCurrencyBefore).to.equal(totalExecutionPrice - totalFee);
    expect(fillerCurrencyAfter - fillerCurrencyBefore).to.equal(totalFee);

  });


});