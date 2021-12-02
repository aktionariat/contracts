module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, multiSigDefaultOwner } = await getNamedAccounts();

  const multisigCloneFactoryDeployment= await deployments.get("MultiSigCloneFactory");
  const multisigCloneFactory = await ethers.getContractAt("MultiSigCloneFactory", multisigCloneFactoryDeployment.address);
  const createTx = await multisigCloneFactory.create(multiSigDefaultOwner, ethers.utils.formatBytes32String('1'));
  const { events } = await createTx.wait();
  const { address:multisigAddress } = events.find(Boolean);

  console.log("-----------------------")
  console.log("Deploy MultiSig Clone")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("owner: %s", multisigAddress);
};

module.exports.tags = ["MultiSigClone"];
module.exports.dependencies = ["MultiSigCloneFactory"];