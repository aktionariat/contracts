module.exports = {
  // Parameters used during contract development and testing
  symbol: "SHR",
  name: "Test Shares",
  terms: "test.ch/terms",
  totalShares: 10000000,
  sharePrice: "1000000000000000000",
  baseCurrencyAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",  // usdc polygon
  baseCurrencyMinterAddress: "0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9",
  baseCurrencyName: "USD Coin",
  baseCurrencySymbol: "USDC",
  baseCurrencyBalanceSlot: 0,
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  brokerbotRegistry: "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98",
  quorumBps: 7500,
  quorumMigration: 7500,
  votePeriodSeconds: 5184000,
  uniswapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  uniswapQuoterAddress: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
  // Allowlist
  allowlist_symbol: "ASHR",
  allowlist_name: "Test Allowlist Shares",
  allowlist_terms: "wwww.terms.ch",
  allowlist_totalshares: 4000000,
  allowlist_quorumBps: 10,
  allowlist_votePeriodSeconds: 36000,
  // DAI
  daiAddress: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  daiBalanceSlot: 0,
  // WBTC
  wbtcAddress: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  wbtcBalanceSlot: 0,
  wbtcMinterAddress: "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7",
  // WETH
  wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  // USDT
  usdtAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  // USDC
  usdcAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  // brokerbot
  BUYING_ENABLED: 1n,
  SELLING_ENABLED: 2n,
  KEEP_ETHER: 4n
};
