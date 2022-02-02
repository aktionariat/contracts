const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  //const recoveryHub = await ethers.getContractAt("RecoveryHub", "0xfE9098d62aF73EF8a24Bf48a1d0dAD19d7D592e9"); //ropsten
  //const recoveryHub = await ethers.getContractAt("RecoveryHub", "0x6884ade31AC154DC52395F9dB819A03c667063A9"); //mainnet
  const recoveryHub = await deployments.get("RecoveryHub"); //local deploy

  const symbol = "SHR";
  const name = "Swissshore AG Shares";
  const terms = "https://swissshore.com/investor-relations";
  const totalShares = 100000;
  
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Swiss Shore Shares")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("owner: %s", owner); // don't forget to set it in the .env => hardhat config

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("SSAShares", {
    contract: "Shares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      owner,
      recoveryHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["SSAShares"];
if (network.name == "hardhat") {
  module.exports.dependencies = ["RecoveryHub"];
}