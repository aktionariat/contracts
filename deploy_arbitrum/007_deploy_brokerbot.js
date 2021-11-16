module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const multisig = await deployments.get('MultiSigTest');
  const shares = await deployments.get('Shares');

  console.log("-----------------------")
  console.log("Deploy Brokerbot")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);
  console.log("owner: %s", multisig.address)

  const price = "500000000000000000";
  const increment = 10;
  const baseCurrencyContract = "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08";

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Brokerbot", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      shares.address,
      price,
      increment,
      baseCurrencyContract,
      multisig.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["Brokerbot"];
module.exports.dependencies = ["Shares", "multisig"];