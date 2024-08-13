const {network, ethers, deployments } = require("hardhat");
const { Interface } = require("ethers");
const Confirm = require('prompt-confirm');

const {config} = require('./factory_config.js');

async function main() {
  let brokerbotFactory;
  let brokerbotAddr;

  let deployer
  let owner;
  let sig1;

  [deployer,owner,sig1,sig2,sig3,sig4,sig5,sig6] = await ethers.getSigners();

  const brokerbotEventABI = ["event BrokerbotCreated(address indexed brokerbot, address indexed token, address indexed owner)"];
  const ifaceBrokerbot = new Interface(brokerbotEventABI);
  
  brokerbotFactory = await ethers.getContract("BrokerbotFactory");
  
  const brokerbotConfig = {
    price: ethers.parseUnits(config.brokerbot.price, 18),
    increment: ethers.parseUnits(config.brokerbot.increment, 18),
    baseCurrency: config.brokerbot.baseCurrency
  }
  const sharesAddress = "0x0f4dc5ada841cf5a7652e52d04ae786070cc9472";
  const multisigAddr = "0x53D85cCE84d32E2D8cAd5c73EeF15e97E12968BA";

  const createBrokerbot = await brokerbotFactory.createBrokerbot(brokerbotConfig, sharesAddress, multisigAddr, "GMCZCHF");
  const receipt = await createBrokerbot.wait();
  receipt.logs.forEach((log) => {
    const parsedLog = ifaceBrokerbot.parseLog(log);
    if (parsedLog) {
      console.log(`deployed brokerbot: ${parsedLog.args.brokerbot}`);
      brokerbotAddr = parsedLog.args.brokerbot;
    }
  });

  // register brokerbot at registry
  brokerbotRegistry = await ethers.getContractAt("BrokerbotRegistry", config.registry.mainnet); // is fixed address (change will mess up subgraph)
  const prompt = await new Confirm("Register brokerbot?").run();
  if(prompt) {
    await brokerbotRegistry.connect(deployer).registerBrokerbot(brokerbotAddr, brokerbotConfig.baseCurrency, sharesAddress, { gasLimit: 50000});
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });