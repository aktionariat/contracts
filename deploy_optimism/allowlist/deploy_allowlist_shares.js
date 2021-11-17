module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, multiSigDefaultOwner } = await getNamedAccounts();

  const multisigCloneFactoryDeployment= await deployments.get("MultiSigCloneFactory");
  const multisigCloneFactory = await ethers.getContractAt("MultiSigCloneFactory", multisigCloneFactoryDeployment.address);
  const createTx = await multisigCloneFactory.create(multiSigDefaultOwner, ethers.utils.formatBytes32String('111'));
  const { events } = await createTx.wait();
  const { address:multisigAddress } = events.find(Boolean);

  const recoveryHub = await deployments.get("RecoveryHub");

  console.log("-----------------------")
  console.log("Deploy Allowlist Shares")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("owner: %s", multisigAddress)

  const symbol = "ASHR";
  const name = "Test Allowlist Share ";
  const terms = "wwww.terms.ch";
  const totalShares = 4000000;

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("AllowlistShares", {
    contract: "AllowlistShares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      recoveryHub.address,
      multisigAddress],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["AllowlistShares"];
module.exports.dependencies = ["MultiSigCloneFactory", "RecoveryHub"];