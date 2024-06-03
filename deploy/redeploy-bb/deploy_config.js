const { paymentHubAddress } = require("../../scripts/deploy_config_mainnet");

module.exports = {
  // Parameters used during contract development and testing
  symbol: "DQTS",
  shareAddress: "0x8747a3114Ef7f0eEBd3eB337F745E31dBF81a952",
  paymentHubAddress: "0xaf1A5a633A31f8659F06e32da7b41E207AdAd43C", // one WITHOUT the new path for payFromEther
  sharePrice: "8224150000000000000",
  increment: "30000000000000",
  // baseCurrencyAddress: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08", // mainent xchf
  baseCurrencyAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB", // mainent zchf
  multisigAddress: "0x81C36908a73C3117C03FE4a625d890987376E69F"
};
