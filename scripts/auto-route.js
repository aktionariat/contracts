const {network, ethers, deployments, } = require("hardhat");
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { encodeRouteToPath } = require("@uniswap/v3-sdk");
const { Protocol } = require("@uniswap/router-sdk");

async function main() {
  const ethersProvider = new ethers.providers.Web3Provider(network.provider);
  const router = new AlphaRouter({ chainId: 1, provider: ethersProvider });
  const WETH = new Token(
    1,
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    18,
    'WETH',
    'Wrapped Ether'
  );

  const DAI = new Token(
    1,
    '0x6b175474e89094c44da98b954eedeac495271d0f',
    18,
    'DAI',
    'Dai Stablecoin'
  );

  const XCHF = new Token(
    1,
    '0xB4272071eCAdd69d933AdcD19cA99fe80664fc08',
    18,
    'XCHF',
    'CryptoFranc'
  );

  const WBTC = new Token(
    1,
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    8,
    'WBTC',
    'Wrapped BTC'
  );

  const USDC = new Token(
    1,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    6,
    'USDC',
    'USD//C'
  );

  const ROUTING_CONFIG = {
    maxSwapsPerPath: 2,
    minSplits: 0,
    maxSplits: 0,
  };

  let sig1;
  [sig1] = await ethers.getSigners();
  const daiAmount = ethers.parseUnits("10000", 18);
  const daiCurrencyAmount = CurrencyAmount.fromRawAmount(XCHF, daiAmount);
  const alphaRouterConfig = {
    protcols: Protocol.V2,
    maxSplits: 1,
    maxSwapsPerPath: 2
  };
  const route = await router.route(
    daiCurrencyAmount,
    WBTC,
    TradeType.EXACT_OUTPUT,
    {
      recipient: sig1.address,
      slippageTolerance: new Percent(2, 100),
      deadline: 100
    },
    { protocols: [Protocol.V3] }
  );

  //console.log(route.route[0]);
  console.log(route);
  console.log(route.route[0].tokenPath);
  const encodedPath = encodeRouteToPath(route.route[0].route, true);
  console.log(encodedPath);
  console.log(`Gas Adjusted Quote In: ${route.quoteGasAdjusted.toFixed(2)}`);
  console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed(6)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });