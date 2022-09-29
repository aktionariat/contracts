const Confirm = require('prompt-confirm');
const config = require("./deploy_config.json");

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;
  
  const shares = await deployments.get('Shares'+config.symbol);
  const recoveryHub = await deployments.get("RecoveryHub");
  const offerFactory = await deployments.get("OfferFactory");
  
  const terms = config.terms;
  const quorumBps = config.quorumBps;
  const votePeriodSeconds = config.votePeriodSeconds;
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy DraggableShares " + config.symbol);
    console.log("-----------------------");
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

  const { address } = await deploy("DraggableShares"+config.symbol, {
    contract: "DraggableShares",
    from: deployer,
    args: [
      terms,
      shares.address,
      quorumBps,
      votePeriodSeconds,
      recoveryHub.address,
      offerFactory.address,
      owner],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["DraggableShares"+config.symbol];
module.exports.dependencies = ["Shares"+config.symbol, "RecoveryHub", "OfferFactory"];