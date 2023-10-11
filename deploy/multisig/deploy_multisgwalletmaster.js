const Confirm = require('prompt-confirm');
const { getGasPrice } = require('../../scripts/helper/polygongasstation.js');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();

  if (network.name != "hardhat") {
    console.log("------------------------------")
    console.log("Deploy MultiSigWallet Master")
    console.log("------------------------------")
    console.log(`deployer: ${deployer}`);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("MultiSigWalletMaster", {
    contract: "MultiSigWalletMaster",
    from: deployer,
    args: [],
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    log: true
  });
};

module.exports.tags = ["MultiSigWalletMaster"];