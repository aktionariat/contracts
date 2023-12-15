const Confirm = require('prompt-confirm');
const nconf = require('nconf');
const config = require("../scripts/deploy_config_optimism.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  let brokerbotRegistry
  if (network.name != "hardhat") {
    //brokerbotRegistry = "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98"; //for production deployment
    brokerbotRegistry = config.brokerbotRegistryAddress;
  } else {
    const brokerbotRegistryContract = await deployments.get('BrokerbotRegistry'); // for testing
    brokerbotRegistry = brokerbotRegistryContract.address;
  }
  const uniswapQuoter = config.uniswapQuoterAddress;
  const wethAddress = config.wethAddress;
    
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Brokerbot Quoter")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("weth: %s", wethAddress);
    console.log("uniswapQuoter: %s", uniswapQuoter);
    console.log("registry: %s", brokerbotRegistry);  // don't forget to set it in hardhat.config.js as the multsig account

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("BrokerbotQuoter", {
    contract: "BrokerbotQuoter",
    from: deployer,
    args: [
      wethAddress,
      uniswapQuoter,
      brokerbotRegistry],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["BrokerbotQuoter"];
module.exports.dependencies = ["BrokerbotRegistry"];