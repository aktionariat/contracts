module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();

  console.log("------------------------------")
  console.log("Deploy MultiSigWallet Master")
  console.log("------------------------------")
  console.log(`deployer: ${deployer}`);

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("MultiSigWalletMaster", {
    contract: "MultiSigWallet",
    from: deployer,
    args: [],
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    log: true
  });
};

module.exports.tags = ["MultiSigWalletMaster"];