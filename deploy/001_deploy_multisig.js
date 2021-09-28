module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("MultiSigTest", {
    contract: "MultiSig",
    from: deployer,
    args: [dev],
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    log: true
  });
};

module.exports.tags = ["multisig"];