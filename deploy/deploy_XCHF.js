const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();


  const initialFullName = "XCHF_2021-Q4";
  const dustAmount = ethers.BigNumber.from("10000000000000000");
  
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy XCHF")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", deployer); // don't forget to set it in the hardhat config

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("CryptoFranc", {
    contract: "CryptoFranc",
    from: deployer,
    args: [
      initialFullName,
      dustAmount
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["CryptoFranc"];