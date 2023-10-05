const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  const brokerbotRouterAddress = "";
  const brokerbotRouter = await deployments.get('BrokerbotRouter'); // for testing

  console.log("-----------------------")
  console.log("Deploy ExampleTrades")
  console.log("-----------------------")
  console.log("deployer: %s", deployer);

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("ExampleTrades", {
    contract: "ExampleTrades",
    from: deployer,
    args: [
      brokerbotRouter.address
      ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["ExampleTrades"];
module.exports.dependencies = ["BrokerbotRouter"];