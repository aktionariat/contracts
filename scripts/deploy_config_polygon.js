module.exports = {
  // Parameters used during contract development(non-tasktemplate) and testing
  chainId: 137,
  symbol: "SHR",
  name: "Test Shares",
  terms: "test.ch/terms",
  totalShares: 10000000,
  sharePrice: "1000000", // with usdc (decimals 6)
  baseCurrencyAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",  // usdc polygon
  baseCurrencyMinterAddress: "0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9",
  baseCurrencyName: "USD Coin (PoS)",
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
  wethAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // use wmatic for tests
  //wethAddress: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  // WMATIC
  wmaticAddres: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  // USDT
  usdtAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  usdtBalanceSlot: 0,
  // USDC
  usdcAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // use usdt for tests
  //usdcAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  // brokerbot
  BUYING_ENABLED: 1n,
  SELLING_ENABLED: 2n,
  KEEP_ETHER: 4n,
  //permit2
  permit2Address: "0x000000000022d473030f116ddee9f6b43ac78ba3", // Mainnet, Goerli, Arbitrum, Optimism, Polygon
  // hub and standard addresses  (aktionariat)
  // brokerbotRegistry: "0xec0739be570c77c9b544802e4c06a95be719ee5f", // polygon test companies
  // mumbai
  brokerbotRegistryAddress: "0x276f97Cc7C685fDA1B099723CeB87F65d2ec89bE", // mumbai
  offerFactoryAddress: "0x4A9519256A707873a32d0e436182AeE2967694C4", // mumbai
  recoveryHubAddress: "0x1776C349696CccAE06541542C5ED954CDf9859cC", // mumbai
  permit2HubAddress: "0xd6e98A2BDe37B7bCA4D265429D91af5c3CA3E74a", // mumbai
  paymentHubAddress: "0x6a972E875f4bB56b1e82027aEa3E58076d32119c" // mumbai
};
