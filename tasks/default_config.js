const config = {
  xchf: {
    mainnet: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08", // mainent xchf
    optimism: "0xE4F27b04cC7729901876B44f4EAA5102EC150265", // optimism xchf
    goerli: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // goerli usdc
    sepolia: "0x2181c6817Cc2429bbf5C50D532D18c7008E6863A", // sepolia usdc
    polygon: "0x23a72dfa62cd95c08ee116a285ae4f05cbeccd18", // ploygon xchf
  },
  brokerbotRegistry: {
    mainnet: "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98",
    optimism: "0x2C9b9b9143A9Ef5051A299EF3CC8039b06927093",
    polygon: "0x6548FAD069F2eDa512a658c17606Eed81095c93D", // for test companies
    //polygon: "0xec0739be570c77c9b544802e4c06a95be719ee5f", // for live
    mumbai: "0x276f97Cc7C685fDA1B099723CeB87F65d2ec89bE"
  },
  recoveryHub: {
    mainnet: "",
    optimism: "",
    polygon: "0x0235FB5902b84885bA79BDbce417C49E3720eb2d",
    mumbai: "0x1776C349696CccAE06541542C5ED954CDf9859cC"
  },
  offerFactory: {
    mainnet: "",
    optimism: "",
    polygon: "0x425cE8A2d6A2fAF2506ce32437666d3156136a43",
    mumbai: "0x4A9519256A707873a32d0e436182AeE2967694C4"
  },
  paymentHub: {
    mainnet: "",
    optimism: "",
    polygon: "0x562Db37cc371765DfB7A66A9277f1786ECf1499f",
    mumbai: "0x6a972E875f4bB56b1e82027aEa3E58076d32119c"
  },
  permit2Hub: {
    mainnet: "",
    optimism: "",
    polygon: "0xF08c085748711078C32338e3356c0E533a4a22aC",
    mumbai: "0xd6e98A2BDe37B7bCA4D265429D91af5c3CA3E74a"
  },
  deployLogDir: "./deploy_log"
};

module.exports = {config};