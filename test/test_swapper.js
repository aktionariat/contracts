const {network, ethers, deployments, } = require("hardhat");
const { setup, setBalances, getBlockTimeStamp, randomBigInt, setBalance } = require("./helper/index");
const Chance = require("chance");
const { expect } = require("chai");

// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);

describe("Swapper", () => {
  let baseCurrency;
  let zchfContract
  let swapper;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;

  let chance;
  let randomAmount;
  let slippage = 300n;

  before(async () => {
    let chainid = (await ethers.provider.getNetwork()).chainId;
    console.log("ChainId: ", chainid);
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    chance = new Chance();

    // get common contracts
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    zchfContract = await ethers.getContractAt("ERC20Named", config.zchfAddress);
  });

  beforeEach(async () => {
    // deploy contracts
    await deployments.fixture([
      "Swapper"
    ]);
    swapper = await ethers.getContract("Swapper");

    setBalance(baseCurrency, config.xchfBalanceSlot, accounts);
  });

  describe("Deployment", () => {
    it("Should swapper successfully", async () => {
      expect(await swapper.getAddress()).to.exist;
    });

    it("Should have correct initial state", async () => {
      expect(await swapper.uniswapRouter()).to.be.equal(config.uniswapRouterAddress);
      expect(await swapper.swapFrom()).to.be.equal(await baseCurrency.getAddress());
      expect(await swapper.swapTo()).to.be.equal(await zchfContract.getAddress());
    });
  });

  describe("Swap", () => {
    beforeEach(async () => {
      randomAmount = randomBigInt(5, 500); // xchf liquidity is limited
      minAmountOut = randomAmount * (10000n - slippage) / 10000n;
    });

    it("Should swapp correctly", async() => {
      const swappAccount = sig1;
      await baseCurrency.connect(swappAccount).approve(await swapper.getAddress(), randomAmount);
      const xchfBalanceBefore = await baseCurrency.balanceOf(swappAccount.address);
      const zchfBalanceBefore = await zchfContract.balanceOf(swappAccount.address);
      await swapper.connect(sig1).swap(randomAmount);
      const xchfBalanceAfter = await baseCurrency.balanceOf(swappAccount.address);
      const zchfBalanceAfter = await zchfContract.balanceOf(swappAccount.address);
      expect(xchfBalanceAfter).to.be.equal(xchfBalanceBefore - randomAmount);
      expect(zchfBalanceAfter).to.be.greaterThanOrEqual(zchfBalanceBefore + minAmountOut);
    })
  });
});
