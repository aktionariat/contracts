module.exports = {
  // Parameters used during contract development and testing
  symbol: "SHR",
  name: "Test Shares",
  terms: "test.ch/terms",
  totalShares: 10000000,
  sharePrice: "1000000000000000000",
  baseCurrencyAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // optimism dai
  baseCurrencyMinterAddress: "0xad32aA4Bff8b61B4aE07E3BA437CF81100AF0cD7", //optimism
  baseCurrencyName: "Dai Stablecoin",
  baseCurrencySymbol: "DAI",
  xchfBalanceSlot: 2,
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  quorumBps: 7500,
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
  daiAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",//optimis
  daiBalanceSlot: 2,
  // WBTC
  wbtcAddress: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
  wbtcBalanceSlot: 0,
  wbtcMinterAddress: "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7",
  // WETH
  wethAddress: "0x4200000000000000000000000000000000000006",
  // brokerbot
  BUYING_ENABLED: 0x1,
  SELLING_ENABLED: 0x2,
  KEEP_ETHER: 0x4
};
