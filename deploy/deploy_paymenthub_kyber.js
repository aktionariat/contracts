module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("-----------------------")
  console.log("Deploy Paymenthub")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);

  const baseCurrencyContract = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; // usdc polygon
  const kyberDMMRouter = "0x546C79662E028B661dFB4767664d0273184E4dD1"
  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("PaymentHubKyber", {
    contract: "PaymentHubKyber",
    from: deployer,
    args: [
      baseCurrencyContract,
      kyberDMMRouter],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["PaymentHubKyber"];