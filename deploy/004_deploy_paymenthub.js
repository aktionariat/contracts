module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const multisig = await deployments.get('MultiSigTest');
  const shares = await deployments.get('Shares');

  console.log("-----------------------")
  console.log("Deploy Paymenthub")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);

  const baseCurrencyContract = "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08";

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("PaymentHub", {
    contract: "PaymentHub",
    from: deployer,
    args: [
      baseCurrencyContract,],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHub"];