import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getImpersonatedSigner } from "../helpers/getImpersonatedSigner";
import { Brokerbot, DraggableShares, IERC20, PaymentHub } from "../../typechain-types";
import { switchForkedNetwork } from "../helpers/switchNetwork";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { infiniteAllowance } from "../../ignition/modules/TestModule";

// Test DAKS purchase with USDC

describe("Test Equanimity", function () {
  let daks: DraggableShares;
  let brokerbot: Brokerbot;
  let paymentHub: PaymentHub;
  let usdc: IERC20
  let fiatTokenV2: IERC20;
  let uniswapRouterV3Address = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  let buyerSigner: HardhatEthersSigner;
  let buyingAmount = 1n;

  function getUniswapPath(): string {
    const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const zchf = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
    const fee = 100;
    const path = ethers.solidityPacked(
      ["address", "uint24", "address", "uint24", "address"],
      [zchf, fee, usdt, fee, usdc]
    );
  
    return path;
  }

  async function getBuyPrices(): Promise<[bigint, bigint]> {
    const priceZCHF = await brokerbot.getBuyPrice(buyingAmount);
    const priceUSDC = await paymentHub.getPriceInERC20.staticCall(priceZCHF, getUniswapPath());    
    return [priceZCHF, priceUSDC];
  }
  
  before(async function() {
    await switchForkedNetwork("mainnet");
    
    daks = await ethers.getContractAt("DraggableShares", "0x6f38e0f1a73c96cB3f42598613EA3474F09cB200");
    brokerbot = await ethers.getContractAt("Brokerbot", "0x2f2c3cf0b2d6f4f6cd5f57665ae629eee813350b");
    paymentHub = await ethers.getContractAt("PaymentHub", "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709");
    usdc = await ethers.getContractAt("IERC20", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    fiatTokenV2 = await ethers.getContractAt("IERC20", "0x43506849D7C04F9138D1A2050bbF3A0c054402dd");
    
    buyerSigner = await getImpersonatedSigner("0x45AC69479611EF0BC9B18eF2B3C454D946705C44");
    setBalance(await buyerSigner.getAddress(), ethers.parseEther("1"));
  });

  it("Should be able to get correct path", async function () {
    const path = getUniswapPath();
    expect(path).to.equal("0xb58e61c3098d85632df34eecfb899a1ed80921cb000064dac17f958d2ee523a2206206994597c13d831ec7000064a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
  });

  it("Should be able to get prices correctly", async function () {
    const [priceZCHF, priceUSDC] = await getBuyPrices();
    expect(priceZCHF).to.equal(ethers.parseUnits("7.25", 18));
    expect(priceUSDC).to.greaterThan(ethers.parseUnits("7.25", 6));
  });

  it("Buyer should have enough USDC", async function () {
    const [priceZCHF, priceUSDC] = await getBuyPrices();
    expect(await usdc.balanceOf(buyerSigner)).to.greaterThan(priceUSDC);
  });

  it("Should allow PaymentHub to spend USDC of signer", async function () {
    const [priceZCHF, priceUSDC] = await getBuyPrices();
    const allowance = await usdc.allowance(buyerSigner, paymentHub);
    expect(allowance).to.greaterThanOrEqual(priceUSDC);    
  });

  it("Should allow UniswapRouterV3 to spend USDC of signer", async function () {
    const [priceZCHF, priceUSDC] = await getBuyPrices();
    await usdc.connect(buyerSigner).approve(uniswapRouterV3Address, infiniteAllowance);
    const allowance = await usdc.allowance(buyerSigner, uniswapRouterV3Address);
    expect(allowance).to.greaterThanOrEqual(priceUSDC);    
  });

  it("UniswapRouterV3 should be able to spend tokens from PaymentHub", async function () {
    const [priceZCHF, priceUSDC] = await getBuyPrices();
    const allowanceUSDC = await usdc.allowance(paymentHub, uniswapRouterV3Address);
    const allowanceFiatToken = await fiatTokenV2.allowance(paymentHub, uniswapRouterV3Address);

    expect(allowanceUSDC).to.greaterThanOrEqual(priceUSDC);    
    expect(allowanceFiatToken).to.greaterThanOrEqual(priceUSDC);    
  });

  it("Should be able to buy DAKS with USDC", async function () {
    const [priceZCHF, priceUSDC] = await getBuyPrices();

    const buyerBalanceBefore = await daks.balanceOf(buyerSigner);

    expect(await paymentHub.connect(buyerSigner).payFromERC20AndNotify(brokerbot, priceZCHF, usdc, priceUSDC, getUniswapPath(), "0x")).to.not.be.reverted;

    const buyerBalanceAfter = await daks.balanceOf(buyerSigner);
    expect(buyerBalanceBefore + buyingAmount).to.equal(buyerBalanceAfter);
  });

});