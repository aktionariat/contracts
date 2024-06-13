const {network, ethers, deployments } = require("hardhat");
const Confirm = require('prompt-confirm');

const { getGasPrice } = require('../scripts/helper/polygongasstation.js');

async function main() {

  const [mainnet, deployer] = await ethers.getSigners();
  const baseCurrencyAddress = "0x02567e4b14b25549331fCEe2B56c647A8bAB16FD"; //ZCHF polygon

  const { deploy } = deployments;
    
  if (network.name != "hardhat") {
    console.log("-----------------------")
    console.log("Deploy Brokerbot Registry")
    console.log("-----------------------")
    console.log("deployer: %s", deployer.address);
    console.log("owner: %s", deployer.address); 

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }
  const feeData = await getGasPrice();

  const { address: brokerbotRegistryAdr } = await deploy("BrokerbotRegistry", {
    contract: "BrokerbotRegistry",
    from: deployer.address,
    args: [
      deployer.address],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });

  const brokerbotRegistry = await ethers.getContractAt("BrokerbotRegistry", brokerbotRegistryAdr);
  console.log(brokerbotRegistryAdr);
  const prompt = await new Confirm("brokerbot regisry deployment correct?").run();
  if(!prompt) {
    console.log("exiting");
    process.exit();
  }

  const { address: tokenRegistryAdr } = await deploy("TokenRegistry", {
    contract: "TokenRegistry",
    from: deployer.address,
    args: [
      deployer.address,
      brokerbotRegistryAdr
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  const addressRegistry = await ethers.getContractAt("TokenRegistry", tokenRegistryAdr);

  // register brokerbots
  const operaBrokerbot = "0x1D4b45FF4f542E6C08E3BB1806518a209e553336";
  console.log("register operal");
  await brokerbotRegistry.connect(deployer).registerBrokerbot(operaBrokerbot, tokenRegistryAdr);

  console.log("register nest");
  const nestBrokerbot = "0xAa5189c2E09f278805C96ca0407B87f971BE78F9";
  await brokerbotRegistry.connect(deployer).registerBrokerbot(nestBrokerbot, tokenRegistryAdr);

  console.log("register intrinsic");
  const intrinsicShare = "0xffa4D7AC86909b70FC966ac0d03A86B9C7F5b9c6";
  await addressRegistry.connect(deployer).addShareToken(intrinsicShare);

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });