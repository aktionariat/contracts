const Confirm = require('prompt-confirm');
const nconf = require('nconf');


module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = nconf.get("multisigAddress");
  const symbol = nconf.get("symbol");
  const shares = await deployments.get(symbol+"AllowlistShares");
  
  const recoveryHubAddress = nconf.get("address:recoveryHub");
  const offerFactoryAddress = nconf.get("address:offerFactory");
  const permit2HubAddress = nconf.get("address:permit2Hub");
  
  const terms = nconf.get("terms");
  const quorumBps = nconf.get("quorumBps");
  const quorumMigration = nconf.get("quorumMigration");
  const votePeriodSeconds = nconf.get("votePeriodSeconds");

  const params = {
    wrappedToken: shares.address,
    quorumDrag: quorumBps,
    quorumMigration: quorumMigration,
    votePeriod: votePeriodSeconds
  }

  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Allowlist DraggableShares " + symbol)
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("recoveryHub: %s", recoveryHubAddress);
    console.log("offer factory: %s", offerFactoryAddress);
    console.log("permit2hub: %s", permit2HubAddress);
    console.log("owner: %s", owner); // don't forget to set it in deploy_config_mainnet.js as the multsigadr
    
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  
  const feeData = await ethers.provider.getFeeData();

  const { address, receipt } = await deploy(symbol+"AllowlistDraggableShares", {
    contract: "AllowlistDraggableShares",
    from: deployer,
    args: [
      terms,
      params,
      recoveryHubAddress,
      offerFactoryAddress,
      owner,
      permit2HubAddress
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    gasLimit: 3000000
  });

  // set config
  nconf.set("brokerbot:shares", address);
  nconf.set("address:allowlist:draggable", address);
  nconf.set("blocknumber", String(receipt.blockNumber));
};

module.exports.tags = [nconf.get("symbol")+"AllowlistDraggableShares"];
module.exports.dependencies = [nconf.get("symbol")+"AllowlistShares"];
