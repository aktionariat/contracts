const Confirm = require('prompt-confirm');
const config = require("./deploy_config.js");


module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;
  const shares = await deployments.get('AllowlistShares'+config.symbol);
  const recoveryHub = await deployments.get("RecoveryHub");
  const offerFactory = await deployments.get("OfferFactory");
  
  const terms = config.terms;
  const quorumBps = config.quorumBps;
  const votePeriodSeconds = config.votePeriodSeconds;

  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Allowlist DraggableShares " + config.symbol)
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("offer factory: %s", offerFactory.address);
    console.log("owner: %s", owner); // don't forget to set it in deploy_config.js as the multsigadr
    
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  
  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("AllowlistDraggableShares"+config.symbol, {
    contract: "AllowlistDraggableShares",
    from: deployer,
    args: [
      terms,
      shares.address,
      quorumBps,
      votePeriodSeconds,
      recoveryHub.address,
      offerFactory.address,
      owner,
      owner],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    gasLimit: 3000000
  });
};

module.exports.tags = ["AllowlistDraggableShares"+config.symbol];
module.exports.dependencies = ["RecoveryHub", "OfferFactory", "AllowlistShares"+config.symbol];