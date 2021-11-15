module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev, multiSigDefaultOwner } = await getNamedAccounts();

  console.log(`deployer: ${deployer}`);
  console.log(`multiSigDefaultOwner: ${multiSigDefaultOwner}`);

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