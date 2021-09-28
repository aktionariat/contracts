module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();
  console.log(deployer);

  const symbol = "B59";
  const name = "Test Bond 1559 ";
  const terms = "wwww.terms.ch";
  const maxSupply = 4000000;
  const termToMaturity = "432000000"; //5000days around 14y
  const mintDecrement = 10;

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Bond", {
    contract: "Bond",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      maxSupply,
      termToMaturity,
      mintDecrement,
      dev],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["bond"];