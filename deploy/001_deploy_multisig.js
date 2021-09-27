module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();
  console.log(deployer);

  const { address } = await deploy("MultiSigTest", {
    contract: "MultiSig",
    from: deployer,
    args: [dev],
    gasLimit: 5000000,
    log: true
  });
};

module.exports.tags = ["MultiSig"];