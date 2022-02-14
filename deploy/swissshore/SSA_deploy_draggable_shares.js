const { network } = require('hardhat');
const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  
  const shares = await deployments.get('SSAShares');
  const recoveryHub = await deployments.get("RecoveryHub"); 
  const offerFactory = await deployments.get("OfferFactory");
  
  const terms = "https://swissshore.com/investor-relations";
  const quorumBps = 7500;
  const votePeriodSeconds = 5184000;
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Swiss Shore DraggableShares");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("offer factory: %s", offerFactory.address);
    console.log("shares: %s", shares.address);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("SSADraggableShares", {
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

module.exports.tags = ["SSADraggableShares"];
module.exports.dependencies = ["SSAShares","OfferFactory","RecoveryHub"];
