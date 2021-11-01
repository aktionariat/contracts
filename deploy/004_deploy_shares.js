module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const multisig = await deployments.get("MultiSigTest");
  const recoveryHub = await deployments.get("RecoveryHub");

  console.log("-----------------------")
  console.log("Deploy Shares")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("owner: %s", multisig.address)

  const symbol = "SHR";
  const name = "Test Share ";
  const terms = "wwww.terms.ch";
  const totalShares = 4000000;

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Shares", {
    contract: "Shares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      multisig.address,
      recoveryHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["Shares"];
module.exports.dependencies = ["multisig"];
module.exports.dependencies = ["RecoveryHub"];