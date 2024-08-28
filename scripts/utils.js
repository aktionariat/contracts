const {network, ethers, deployments} = require("hardhat");

const getConfigPath = () => {
  console.log(network.config.chainId);
  switch (network.config.chainId) {
    case 1:
      return "/scripts/deploy_config_mainnet.js";
    case 137:
      return "/scripts/deploy_config_polygon.js";
    case 10:
      return "/scripts/deploy_config_optimism.js";
    default:
      return "/scripts/deploy_config_mainnet.js";
  }
}


module.exports = {
  getConfigPath
}