const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev, multiSigDefaultOwner } = await getNamedAccounts();

  const lockupMaster = await deployments.get('LockupSharesMaster');


  if (network.name != "hardhat") {
    console.log("------------------------------")
    console.log("Deploy Lockup Clone Factory")
    console.log("------------------------------")
    console.log(`deployer: ${deployer}`);
    console.log(`LockupSharesMaster: ${LockupSharesMaster.address}`);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("LockupFactory", {
    contract: "LockupFactory",
    from: deployer,
    args: [lockupMaster.address],
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    log: true
  });
};

module.exports.tags = ["LockupFactory"];
module.exports.dependencies = ['LockupSharesMaster'];