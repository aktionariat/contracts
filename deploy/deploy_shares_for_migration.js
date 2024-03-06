const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");
  //const recoveryHub = "0xc6AfD3b605957b9BA94143F59d451c657F507516";
  const permit2Hub = await deployments.get("Permit2Hub");


  const symbol = "MS";
  const name = "Migration Shares";
  const terms = "migration.ch/terms";
  const totalShares = 10000000;

  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy SharesMigration")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub);
    console.log("owner: %s", deployer); // don't forget to set it in the hardhat config
    console.log("permit2Hub: %s", permit2Hub.address); 

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("SharesMigration", {
    contract: "Shares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      deployer,
      recoveryHub.address,
      permit2Hub.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["SharesMigration"];
module.exports.dependencies = ["RecoveryHub"];