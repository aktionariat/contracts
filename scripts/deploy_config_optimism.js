module.exports = {
  // Parameters used during contract development and testing
  symbol: "OES",
  name: "Optimistic Example AG Shares",
  terms: "test.ch/terms",
  totalShares: 10000000,
  sharePrice: "1000000000000000000",
  increment: "0",
  baseCurrencyAddress: "0xE4F27b04cC7729901876B44f4EAA5102EC150265", // optimism xchf
  baseCurrencyMinterAddress: "0xad32aA4Bff8b61B4aE07E3BA437CF81100AF0cD7", //optimism
  baseCurrencyName: "CryptoFranc",
  baseCurrencySymbol: "XCHF",
  xchfBalanceSlot: 0,
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  brokerbotRegistry: "0x2C9b9b9143A9Ef5051A299EF3CC8039b06927093",
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
  daiAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  daiBalanceSlot: 2,
  // WBTC
  wbtcAddress: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
  wbtcBalanceSlot: 0,
  wbtcMinterAddress: "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7",
  // WETH
  wethAddress: "0x4200000000000000000000000000000000000006",
  // USDT
  usdtAddress: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  // USDC
  usdcAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  // ZCHF
  zchfAddress: "0x4F8a84C442F9675610c680990EdDb2CCDDB8aB6f",
  zchfBalanceSlot: 0,
  // brokerbot
  BUYING_ENABLED: 1n,
  SELLING_ENABLED: 2n,
  KEEP_ETHER: 4n,
  //permit2
  permit2Address: "0x000000000022d473030f116ddee9f6b43ac78ba3", // Mainnet, Goerli, Arbitrum, Optimism, Polygon 
  permit2HubAddress: "0x59f0941e75f2F77cA4577E48c3c5333a3F8D277b",
  // PaymentHub
  paymentHubAddress: "0x7e08078AdCcBFda94daf16184FBfa50acBdEb848"
};
