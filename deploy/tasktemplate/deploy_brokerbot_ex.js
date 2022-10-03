const Confirm = require('prompt-confirm');
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = nconf.get("multisigAddress");
  
  let sharesAddress;
  if(nconf.get("allowlist")){
    if (nconf.get("draggable")){
      sharesAddress = nconf.get("address.allowlist.draggable");
    } else {
      sharesAddress = nconf.get("address.allowlist.shares");
    }
  } else if (nconf.get("draggable")){
    sharesAddress = nconf.get("address.draggable");
  } else {
    sharesAddress = nconf.get("address.shares");
  }
  const paymentHub = await deployments.get("PaymentHub");
  
  const price = nconf.get("sharePrice");
  const increment = nconf.get("increment");
  const baseCurrencyContract = nconf.get("baseCurrencyAddress");
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Brokerbot " + nconf.get("symbol"));
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", sharesAddress);
    console.log("paymentHub: %s", paymentHub.address);
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
      sharesAddress,
      price,
      increment,
      baseCurrencyContract,
      owner,
      paymentHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  nconf.sen("address.brokerbot", address);

  // register brokerbot at registry
  brokerbotRegistry = await ethers.getContract("BrokerbotRegistry")
  brokerbotRegistry.registerBrokerbot(address, baseCurrencyContract, shareAddress);

  // auto verify on etherscan
  if (network.name != "hardhat") {
    await hre.run("etherscan-verify", {
      license: "None"
    });
  }
};


module.exports.tags = ["Brokerbot"+config.symbol];
module.exports.dependencies = ["PaymentHub", "BrokerbotRegistry"];