const { paymentHubAddress } = require("../../scripts/deploy_config_mainnet");

module.exports = {
  // Parameters used during contract development and testing
  symbol: "BOSS",
  shareAddress: "0x2e880962a9609aa3eab4def919fe9e917e99073b",
  paymentHubAddress: "0xaf1A5a633A31f8659F06e32da7b41E207AdAd43C", // one WITHOUT the new path for payFromEther
  sharePrice: "10202370000000000000",
  increment: "5000000000000",
  // baseCurrencyAddress: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08", // mainent xchf
  baseCurrencyAddress: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB", // mainent zchf
  multisigAddress: "0xC63186E1eDd8621C5B63D1fFaEdd1182Ee1572B0"
};