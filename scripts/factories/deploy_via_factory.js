const {network, ethers, deployments } = require("hardhat");
const { Interface } = require("ethers");
const Confirm = require('prompt-confirm');

const {config} = require('./factory_config.js');
// const config = require("../deploy_config_mainnet.js");

async function main() {
  let registry;
  let permit2Hub;
  let offerFactory;
  let factory;
  let tokenFactory;
  let draggableFactory;
  let alowlistDraggableFactory;
  let brokerbotFactory;
  let factoryManager;
  let multiSigCloneFactory

  let deployer
  let owner;
  let sig1;

  [deployer,owner,sig1,sig2,sig3,sig4,sig5,sig6] = await ethers.getSigners();

  const companyEventABI = ["event CompanyCreated(address indexed multisig, address indexed token, address indexed brokerbot)"];
  const ifaceCompany = new Interface(companyEventABI);
  
  factory = await ethers.getContract("AktionariatFactory");
  tokenFactory = await ethers.getContract("TokenFactory");
  
  const tokenConfig = config.token;
  const brokerbotConfig = {
    price: ethers.parseUnits(config.brokerbot.price, 18),
    increment: ethers.parseUnits(config.brokerbot.increment, 18),
    baseCurrency: config.brokerbot.baseCurrency
  }

  const newCompany = await factory.createCompany(tokenConfig, brokerbotConfig, owner, "1");
  const receipt = await newCompany.wait();
  receipt.logs.forEach((log) => {
    const parsedLog = ifaceCompany.parseLog(log);
    if (parsedLog) {
      console.log(`deployed company owner: ${parsedLog.args.multisig}`);
      console.log(`deployed company token: ${parsedLog.args.token}`);
      console.log(`deployed company brokerbot: ${parsedLog.args.brokerbot}`);
    }
  });
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });