const Confirm = require('prompt-confirm');
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  
  if (network.name != "hardhat"&& !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Allowlist Draggable Factory")
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("owner: %s", owner);

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("AllowlistDraggableFactory", {
    contract: "AllowlistDraggableFactory",
    from: deployer,
    args: [
      owner
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    deterministicDeployment: false
  });
};

module.exports.tags = ["AllowlistDraggableFactory"];
