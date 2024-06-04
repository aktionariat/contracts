const config = {
  xchf: {
    mainnet: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08", // mainent xchf
    optimism: "0xE4F27b04cC7729901876B44f4EAA5102EC150265", // optimism xchf
    goerli: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // goerli usdc
    sepolia: "0x2181c6817Cc2429bbf5C50D532D18c7008E6863A", // sepolia usdc
    polygon: "0x23a72dfa62cd95c08ee116a285ae4f05cbeccd18", // ploygon xchf
  },
  zchf: {
    mainnet: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB", // ethereum mainnet zchf
    polygon: "0x02567e4b14b25549331fCEe2B56c647A8bAB16FD", // polygon zchf
  },
  brokerbotRegistry: {
    mainnet: "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98",
    optimism: "0x2C9b9b9143A9Ef5051A299EF3CC8039b06927093",
    polygon: "0x6548FAD069F2eDa512a658c17606Eed81095c93D", // for test companies
    //polygon: "0xec0739be570c77c9b544802e4c06a95be719ee5f", // for live
    mumbai: "0x276f97Cc7C685fDA1B099723CeB87F65d2ec89bE"
  },
  recoveryHub: {
    mainnet: "0x5e200B3C6e9ce8280dbB14A0E5486895456136EF",
    optimism: "",
    polygon: "0xaea2886cb865bab01fc43f3c3f51b27b720ae185",
    mumbai: "0x1776C349696CccAE06541542C5ED954CDf9859cC"
  },
  offerFactory: {
    mainnet: "",
    optimism: "",
    polygon: "0x339891af65dfc0ca929e5521978e07d162514f92",
    mumbai: "0x4A9519256A707873a32d0e436182AeE2967694C4"
  },
  paymentHub: {
    mainnet: "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709",
    optimism: "",
    polygon: "0x3eeffebd88a3b4bc1fe600bfcd1c0a8c8b813980",
    mumbai: "0x6a972E875f4bB56b1e82027aEa3E58076d32119c"
  },
  permit2Hub: {
    mainnet: "0xd3DE54d9e424BF27b8259E69B205127722c771Cb",
    optimism: "",
    polygon: "0xc5e049019fd4c21de3685f60993fd41d3098dca5",
    mumbai: "0xd6e98A2BDe37B7bCA4D265429D91af5c3CA3E74a"
  },
  deployLogDir: "./deploy_log"
};

module.exports = {config};