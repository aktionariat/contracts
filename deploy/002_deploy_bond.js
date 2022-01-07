const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const recoveryHub = await deployments.get("RecoveryHub");

  console.log("-----------------------");
  console.log("Deploy Bond");
  console.log("-----------------------");
  console.log("deployer: %s", deployer);
  console.log("recoveryHub: %s", recoveryHub.address);
  console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account

  const symbol = "BOND";
  const name = "Test Bond";
  const terms = "test.ch/terms";
  const maxSupply = 4000000;
  const termToMaturity = "432000000"; //5000days around 14y
  const mintDecrement = 10;

  let prompt;
  if (network.name != "hardhat") {
    prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Bond", {
    contract: "Bond",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      termToMaturity,
      owner,
      recoveryHub.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["Bond"];
module.exports.dependencies = ["RecoveryHub"];