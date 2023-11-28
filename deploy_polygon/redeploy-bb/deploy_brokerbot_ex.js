const Confirm = require('prompt-confirm');
const config = require("./deploy_config_polygon.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;
  //const shares = await deployments.get('Shares');
  const shares = "0x6f38e0f1a73c96cB3f42598613EA3474F09cB200"
  const paymentHub = "0xbB55b164b641cD0eC89E901884d79f920f310605";
  
  const price = config.sharePrice;
  const increment = config.increment;
  const baseCurrencyContract = config.baseCurrencyAddress;
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Brokerbot " + config.symbol);
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares);
    console.log("paymentHub: %s", paymentHub);
    console.log("base xchf: %s", baseCurrencyContract);
    console.log("owner: %s", owner);  // don't forget to set it in deploy_config.js as the multsigadr

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Brokerbot"+config.symbol, {
    contract: "Brokerbot",
    from: deployer,
    args: [
      shares,
      price,
      increment,
      baseCurrencyContract,
      owner,
      paymentHub],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });

  // register brokerbot at registry
  //brokerbotRegistry = await ethers.getContractAt("BrokerbotRegistry", "0xcB3e482df38d62E73A7aE0E15a2605caDcc5aE98"); // is fixed address (change will mess up subgraph)
  //brokerbotRegistry.registerBrokerbot(address, baseCurrencyContract, shares.address);

  // auto verify on etherscan
  if (network.name != "hardhat") {
    await hre.run("etherscan-verify", {
      license: "None"
    });
  }
};


module.exports.tags = ["Brokerbot"+config.symbol];