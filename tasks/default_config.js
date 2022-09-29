const config = {
  quorumBps: 7500,
  votePeriodSeconds: 5184000,
  xchf: {
    mainnet: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08", // mainent xchf
    optimism: "0xE4F27b04cC7729901876B44f4EAA5102EC150265", // optimism xchf
  },
  deployConfig: "./tasks/deploy_config.json"
};

module.exports = {config};