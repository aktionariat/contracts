import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { version } from "hardhat";

// Test Config
export const TestModuleConfig = {
  permit2Address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  trustedForwarder: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  frankencoinAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  priceFeedCHFUSD: "0x449d117117838fFA61263B61dA6301AA2a88B13A",
  priceFeedETHUSD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  uniswapQuoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
  uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  daiAddress: "0x6b175474e89094c44da98b954eedeac495271d0f",
  usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",

  shareConfig: {
    symbol: "TEST",
    name: "Test Company Shares",
    terms: "https://test.com",
    totalShares: 1000000,
  },

  draggableShareConfig: {
    terms: "https://testdraggable.com",
    quorumDrag: 6600,
    quorumMigration: 6600,
    votePeriod: 5184000  
  },

  brokerbotConfig: {
    price: 1000000000000000000n,
    increment: 0n,
    version: 8n,
    buyingEnabled: 1n,
    sellingEnabled: 2n,
    keepEther: 4n,
    testIncrement: 1000000000000000n,
    testAmount: 10n
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////

const TestModule = buildModule("TestModule", (m) => {
  // Set owner of contracts as Account 1
  const deployer = m.getAccount(0);
  const owner = m.getAccount(1);
  const signers = [m.getAccount(2), m.getAccount(3), m.getAccount(4), m.getAccount(5), m.getAccount(6)]

  // Deploy Everything
  const recoveryHub = m.contract("RecoveryHub", []);
  const offerFactory = m.contract("OfferFactory", []);
  const permit2Hub = m.contract("Permit2Hub", [TestModuleConfig.permit2Address, TestModuleConfig.trustedForwarder]);
  const shares = m.contract("Shares", [TestModuleConfig.shareConfig.symbol, TestModuleConfig.shareConfig.name, TestModuleConfig.shareConfig.terms, TestModuleConfig.shareConfig.totalShares, owner, recoveryHub, permit2Hub]);
  const draggableShares = m.contract("DraggableShares", [TestModuleConfig.draggableShareConfig.terms, [shares, TestModuleConfig.draggableShareConfig.quorumDrag, TestModuleConfig.draggableShareConfig.quorumMigration, TestModuleConfig.draggableShareConfig.votePeriod], recoveryHub, offerFactory, owner, permit2Hub]);
  const draggableSharesWithPredecessor = m.contract("DraggableSharesWithPredecessor", [draggableShares, TestModuleConfig.draggableShareConfig.terms, [shares, TestModuleConfig.draggableShareConfig.quorumDrag, TestModuleConfig.draggableShareConfig.quorumMigration, TestModuleConfig.draggableShareConfig.votePeriod], recoveryHub, offerFactory, owner, permit2Hub]);
  const draggableSharesWithPredecessorExternal = m.contract("DraggableSharesWithPredecessorExternal", [draggableShares, TestModuleConfig.draggableShareConfig.terms, [shares, TestModuleConfig.draggableShareConfig.quorumDrag, TestModuleConfig.draggableShareConfig.quorumMigration, TestModuleConfig.draggableShareConfig.votePeriod], recoveryHub, offerFactory, owner, permit2Hub]);
  const erc20Cancelled = m.contract("ERC20Cancelled", [draggableShares])
  const paymentHub = m.contract("PaymentHub", [TestModuleConfig.trustedForwarder, TestModuleConfig.uniswapQuoter, TestModuleConfig.uniswapRouter, TestModuleConfig.priceFeedCHFUSD, TestModuleConfig.priceFeedETHUSD]);
  const brokerbot = m.contract("Brokerbot", [draggableShares, TestModuleConfig.brokerbotConfig.price, TestModuleConfig.brokerbotConfig.increment, TestModuleConfig.frankencoinAddress, owner, paymentHub]);
  const zchf = m.contractAt("ERC20Named", TestModuleConfig.zchfAddress, { id: "ZCHF"});
  const dai = m.contractAt("ERC20Named", TestModuleConfig.daiAddress, { id: "DAI"});
  const usdc = m.contractAt("ERC20Named", TestModuleConfig.usdcAddress, { id: "USDC"});

  // Setup
  m.call(brokerbot, "setPaymentHub", [paymentHub], { from: owner });
  m.call(draggableShares, "approve", [paymentHub, TestModuleConfig.infiniteAllowance], { from: owner })
  m.call(zchf, "approve", [paymentHub, TestModuleConfig.infiniteAllowance], { from: owner })

  return { 
    recoveryHub,
    offerFactory,
    permit2Hub,
    shares,
    draggableShares,
    draggableSharesWithPredecessor,
    draggableSharesWithPredecessorExternal,
    erc20Cancelled,
    paymentHub, 
    brokerbot,
    zchf,
    usdc,
    dai
   };
});

export default TestModule;
