module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev, multiSigDefaultOwner } = await getNamedAccounts();

  console.log("-----------------------")
  console.log("Deploy Multisig")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("owner: %s", multiSigDefaultOwner)

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("MultiSigTest", {
    contract: "MultiSig",
    from: deployer,
    args: [multiSigDefaultOwner],
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    log: true
  });
};

module.exports.tags = ["multisig"];