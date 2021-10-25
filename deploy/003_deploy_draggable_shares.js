module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("-----------------------")
  console.log("Deploy DraggableShares")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);

  const shares = await deployments.get('Shares');

  const terms = "wwww.terms.ch";
  const quorumBps = 10;
  const votePeriodSeconds = 36000;

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("DraggableShares", {
    contract: "DraggableShares",
    from: deployer,
    args: [
      terms,
      shares.address,
      quorumBps,
      votePeriodSeconds],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["DraggableShares"];
module.exports.dependencies = ['Shares'];