const Confirm = require('prompt-confirm');
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = nconf.get("multisigAddress");

  // const recoveryHub = await deployments.get("RecoveryHub");
  // nconf.set("address:recoveryHub", await recoveryHub.getAddress());
  // nconf.set("address:permit2Hub", await permit2Hub.getAddress());
  const recoveryHub = await ethers.getContractAt("RecoveryHub", nconf.get("address:recoveryHub"));
  const permit2Hub = await ethers.getContractAt("Permit2Hub", nconf.get("address:permit2Hub"));
  
  const symbol = nconf.get("symbol");
  const name = nconf.get("name");
  const terms = nconf.get("terms");
  const totalShares = nconf.get("totalShares");

  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Allowlist Shares " + symbol)
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("permit2hub: %s", await permit2Hub.getAddress());
    console.log("owner: %s", owner)  // don't forget to set it in deploy_config.js as the multsigadr
    
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  
  const feeData = await ethers.provider.getFeeData();

  const { address, receipt } = await deploy(symbol+"AllowlistShares", {
    contract: "AllowlistShares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      await recoveryHub.getAddress(),
      owner,
      await permit2Hub.getAddress()
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  const sharesContract = await ethers.getContract(symbol+"AllowlistShares");
  const version = await sharesContract.VERSION();

  // set config
  nconf.set("brokerbot:shares", address);
  nconf.set("address:allowlist:shares", address);
  nconf.set("blocknumber", receipt.blockNumber);
  nconf.set("version:allowlist:shares", version.toString());
};

module.exports.tags = [nconf.get("symbol")+"AllowlistShares"];
module.exports.dependencies = ["RecoveryHub"];