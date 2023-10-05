const {network, ethers, deployments, } = require("hardhat");
const { setup, getImpersonatedSigner, setBalances, getBlockTimeStamp } = require("./helper/index");
const Chance = require("chance");
const { expect } = require("chai");
const { decodeError } = require('ethers-decode-error');

// Shared  Config
const config = require("../scripts/deploy_config.js");

describe("Brokerbot Router", () => {
  let draggable;
  let shares;
  let paymentHub;
  let brokerbot;
  let brokerbotRouter;
  let brokerbotQuoter;
  let baseCurrency;
  let daiContract;
  let exampleTrades;

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;

  let chance;
  let randomShareAmount;
  let baseAmount;
  let baseBuyPrice;
  let baseSellPrice;

  let pathUsdc;
  let pathBaseUsdc;
  let pathDai;
  let pathWeth;
  let pathSingle;
  let blockTimestamp;

  const xchfWhale = "0x7B4576d06D0Ce1F83F9a9B76BF8077bFFD34FcB1";
  const daksWhale = "0xfa20215178a0E69b8DD02462238027cAC19fb7d2"
  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    chance = new Chance();

    // get common contracts
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    daiContract = await ethers.getContractAt("ERC20Named", config.daiAddress);
    wbtcContract = await ethers.getContractAt("ERC20Named", config.wbtcAddress);
    usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);
    shareContract = await ethers.getContract("ERC20Named", "0x6f38e0f1a73c96cB3f42598613EA3474F09cB200");

    // Set (manipulate local) balances (xchf,dai,wbtc) for first 5 accounts
    await setBalances(accounts, baseCurrency, daiContract, wbtcContract);

  });
  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
          blockNumber: 18283249
        }
      }]
    });
    // deploy contracts
      // deploy contracts
    await deployments.fixture([
      "BrokerbotRouter",
      "BrokerbotQuoter",
      "ExampleTrades", 
    ]);
    brokerbotRouter = await ethers.getContract("BrokerbotRouter");
    brokerbotQuoter = await ethers.getContract("BrokerbotQuoter");
    exampleTrades = await ethers.getContract("ExampleTrades");
  })
  describe("brokerbot router", ()=> {
    it("buy over router", async () => {
      const buyer = sig1;
      //add slippage
      //const baseAmountWithSlippage = baseAmount.add(ethers.utils.parseEther("0.02"));
      await baseCurrency.connect(buyer).approve(brokerbotRouter.address, ethers.constants.MaxUint256);
      const params = {
        tokenIn: baseCurrency.address,
        tokenOut: '0x6f38e0f1a73c96cB3f42598613EA3474F09cB200',
        fee: 0,
        recipient: buyer.address,
        deadline: await getBlockTimeStamp(ethers).then(t => t + 1),
        amountOut: 10,
        amountInMaximum: ethers.utils.parseEther("200"),
        sqrtPriceLimitX96: 0
      }
      await brokerbotRouter.connect(buyer).exactOutputSingle(params);
      //expect(await baseCurrency.balanceOf(paymentHub.address)).to.equal(0);
      //expect(brokerbotBalanceBefore.add(baseAmount)).to.equal(brokerbotBalanceAfter);
      //expect(buyerBalanceBefore.add(randomShareAmount)).to.equal(buyerBalanceAfter);
    })
  })
  describe("Example Trades", () => {
    it("it should buy", async () => {
      const signer = await getImpersonatedSigner(xchfWhale);
      const bal = await baseCurrency.balanceOf(await signer.getAddress());
      console.log(`signer balance: ${ethers.utils.formatEther(bal)}`);
      const exampleTrades = await ethers.getContract("ExampleTrades");
      console.log(`Approving XCHF...`);
      await baseCurrency.connect(signer).approve(exampleTrades.address, ethers.constants.MaxUint256);
      console.log(`Buying shares...`);
      await exampleTrades.connect(signer).buySharesDirect(10, ethers.utils.parseEther("200"));
      const balanceShares = await baseCurrency.balanceOf(signer.getAddress());
      console.log(`Shares bought: ${balanceShares}`);
    
    
    })
    })
});