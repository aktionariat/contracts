module.exports = {
  // Parameters used during contract development and testing
  symbol: "SHR",
  name: "Test Shares",
  terms: "test.ch/terms",
  totalShares: 10000000,
  sharePrice: "1000000000000000000",
  baseCurrencyAddress: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08",
  baseCurrencyMinterAddress: "0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9",
  baseCurrencyName: "CryptoFranc",
  baseCurrencySymbol: "XCHF",
  xchfBalanceSlot: 2,
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  brokerbotRegistry: "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98",
  quorumBps: 7500,
  quorumMigration: 7500,
  votePeriodSeconds: 5184000,
  uniswapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  // Allowlist
  allowlist_symbol: "ASHR",
  allowlist_name: "Test Allowlist Shares",
  allowlist_terms: "wwww.terms.ch",
  allowlist_totalshares: 4000000,
  allowlist_quorumBps: 10,
  allowlist_votePeriodSeconds: 36000,
  // DAI
  daiAddress: "0x6b175474e89094c44da98b954eedeac495271d0f",
  daiBalanceSlot: 2,
  // WBTC
  wbtcAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  wbtcBalanceSlot: 0,
  wbtcMinterAddress: "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7",
  // WETH
  wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  // USDT
  usdtAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  // USDC
  usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  // DCHF
  dchfAddress: "0x045da4bfe02b320f4403674b3b7d121737727a36",
  // ZCHF
  zchfAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  zchfBalanceSlot: 0,
  // brokerbot
  BUYING_ENABLED: 1n,
  SELLING_ENABLED: 2n,
  KEEP_ETHER: 4n,
  //permit2
  permit2Address: "0x000000000022d473030f116ddee9f6b43ac78ba3", // Mainnet, Goerli, Arbitrum, Optimism, Polygon 
  permit2HubAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b"
};
