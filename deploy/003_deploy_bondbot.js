module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();
  const bond = await deployments.get('Bond');

  const price = "500000000000000000";
  const baseCurrencyContract = "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08";

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("BondBot", {
    contract: "BondBot",
    from: deployer,
    args: [
      bond.address,
      price,
      baseCurrencyContract,
      dev],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["BondBot"];
module.exports.dependencies = ['Bond'];