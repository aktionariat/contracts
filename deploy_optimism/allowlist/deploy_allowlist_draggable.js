const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const shares = await deployments.get('AllowlistShares');
  const recoveryHub = await deployments.get("RecoveryHub");
  const offerFactory = await deployments.get("OfferFactory");

  // owner of allowlistshares and allowlist draggableshares is the same.
  // no need to create another multisig wallet
  const sharesContract = await ethers.getContractAt("AllowlistShares", shares.address);
  const owner = await sharesContract.owner();
  
  const terms = "wwww.terms.ch";
  const quorumBps = 10;
  const votePeriodSeconds = 36000;

  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Allowlist DraggableShares")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner)  // don't forget to set it in hardhat.config.js as the multsig account
    
    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  
  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("AllowlistDraggableShares", {
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

module.exports.tags = ["AllowlistDraggableShares"];
module.exports.dependencies = ["RecoveryHub", "OfferFactory", "AllowlistShares"];