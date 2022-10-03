const Confirm = require('prompt-confirm');
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = nconf.get("multisigAddress");

  const recoveryHub = await deployments.get("RecoveryHub");
  
  const symbol = nconf.get("symbol");
  const name = nconf.get("name");
  const terms = nconf.get("terms");
  const totalShares = nconf.get("totalShares");

  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Allowlist Shares " + symbol)
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner)  // don't forget to set it in deploy_config.js as the multsigadr
    
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  
  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("AllowlistShares"+symbol, {
    contract: "AllowlistShares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      recoveryHub.address,
      owner],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  nconf.set("addres.allowlist.shares", address);
};

module.exports.tags = ["AllowlistShares"+config.symbol];
module.exports.dependencies = ["RecoveryHub"];