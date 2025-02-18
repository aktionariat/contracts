import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Test Config
const permit2Address = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const trustedForwarder = "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b";
const frankencoinAddress = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
const priceFeedCHFUSD = "0x449d117117838fFA61263B61dA6301AA2a88B13A";
const priceFeedETHUSD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const uniswapQuoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const infiniteAllowance = "0x8000000000000000000000000000000000000000000000000000000000000000";
const zchfAddress = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB"
const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"


const shareConfig = {
  symbol: "TEST",
  name: "Test Company Shares",
  terms: "https://test.com",
  totalShares: 1000,
}

const draggableShareConfig = {
  terms: "https://testdraggable.com",
  quorumDrag: 7500,
  quorumMigration: 7500,
  votePeriod: 5184000  
}

const brokerbotConfig = {
  price: "1000000000000000000",
  increment: "0",
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
  const permit2Hub = m.contract("Permit2Hub", [permit2Address, trustedForwarder]);
  const shares = m.contract("Shares", [shareConfig.symbol, shareConfig.name, shareConfig.terms, shareConfig.totalShares, owner, recoveryHub, permit2Hub]);
  const draggableShares = m.contract("DraggableShares", [draggableShareConfig.terms, [shares, draggableShareConfig.quorumDrag, draggableShareConfig.quorumMigration, draggableShareConfig.votePeriod], recoveryHub, offerFactory, owner, permit2Hub]);
  const draggableSharesWithPredecessor = m.contract("DraggableSharesWithPredecessor", [draggableShares, draggableShareConfig.terms, [shares, draggableShareConfig.quorumDrag, draggableShareConfig.quorumMigration, draggableShareConfig.votePeriod], recoveryHub, offerFactory, owner, permit2Hub]);
  const draggableSharesWithPredecessorExternal = m.contract("DraggableSharesWithPredecessorExternal", [draggableShares, draggableShareConfig.terms, [shares, draggableShareConfig.quorumDrag, draggableShareConfig.quorumMigration, draggableShareConfig.votePeriod], recoveryHub, offerFactory, owner, permit2Hub]);
  const erc20Cancelled = m.contract("ERC20Cancelled", [draggableShares])
  const paymentHub = m.contract("PaymentHub", [trustedForwarder, uniswapQuoter, uniswapRouter, priceFeedCHFUSD, priceFeedETHUSD]);
  const brokerbot = m.contract("Brokerbot", [draggableShares, brokerbotConfig.price, brokerbotConfig.increment, frankencoinAddress, owner, paymentHub]);
  const zchf = m.contractAt("ERC20Named", zchfAddress, { id: "ZCHF"});
  const dai = m.contractAt("ERC20Named", daiAddress, { id: "DAI"});
  const usdc = m.contractAt("ERC20Named", usdcAddress, { id: "USDC"});

  // Setup
  m.call(brokerbot, "setPaymentHub", [paymentHub], { from: owner });
  m.call(draggableShares, "approve", [paymentHub, infiniteAllowance], { from: owner })
  m.call(zchf, "approve", [paymentHub, infiniteAllowance], { from: owner })

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
