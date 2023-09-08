const Confirm = require('prompt-confirm');
const config = require("../scripts/deploy_config.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts, network }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer);

  const shares = await deployments.get('DraggableShares');
  const paymentHub = await deployments.get('PaymentHub');
  
  const price = config.sharePrice;
  const increment = 0;
  const baseCurrencyContract = "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08";
  
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Brokerbot");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("paymentHub: %s", paymentHub.address);
    console.log("base xchf: %s", baseCurrencyContract);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("Brokerbot", {
    contract: "Brokerbot",
    from: deployer,
    args: [
      shares.address,
      price,
      increment,
      baseCurrencyContract,
      owner,
      paymentHub.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  // only for for local testing !! production deployments need fixed address => see template folder
  //brokerbotRegistry = await ethers.getContractAt("BrokerbotRegistry", config.brokerbotRegistry); // is fixed address (change will mess up subgraph)
  let brokerbotRegistryAddress;
  if (network.name != "hardhat") {
    brokerbotRegistryAddress = config.brokerbotRegistry;
  } else {
    brokerbotRegistryAddress = await deployments.get('BrokerbotRegistry');
  }
  const brokerbotRegistryContract = await ethers.getContractAt("BrokerbotRegistry", brokerbotRegistryAddress);
  await brokerbotRegistryContract.connect(deployerSigner).registerBrokerbot(address, baseCurrencyContract, shares.address, { gasLimit: 50000});
};  

module.exports.tags = ["Brokerbot"];
//module.exports.dependencies = ["DraggableShares", "PaymentHub"]; 
module.exports.dependencies = ["DraggableShares", "PaymentHub", "BrokerbotRegistry"];
