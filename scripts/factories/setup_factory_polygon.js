const {network, ethers, deployments } = require("hardhat");
const Confirm = require('prompt-confirm');

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

  [deployer] = await ethers.getSigners();
  owner = deployer;
  
  factory = await ethers.getContract("AktionariatFactory");
  tokenFactory = await ethers.getContract("TokenFactory");
  brokerbotFactory = await ethers.getContract("BrokerbotFactory");
  factoryManager = await ethers.getContract("FactoryManager");
  draggableFactory = await ethers.getContract("DraggableTokenFactory");
  alowlistDraggableFactory = await ethers.getContract("AllowlistDraggableFactory");

  const paymentHubAddress = "0x3eeffebd88a3b4bc1fe600bfcd1c0a8c8b813980";
  const offerFactoryAddress = "0x339891af65dfc0ca929e5521978e07d162514f92";
  const permit2HubAddress = "0xc5e049019fd4c21de3685f60993fd41d3098dca5";
  const recoveryHubAddress = "0xaea2886cb865bab01fc43f3c3f51b27b720ae185";
  const multiSigCloneFactoryAddress = "0x1776C349696CccAE06541542C5ED954CDf9859cC";
  const factoryManagerAddress = await factoryManager.getAddress();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  const brokerbotFactoryAddress = await brokerbotFactory.getAddress();

  console.log("Setting up Factory Manager...");
  await factoryManager.connect(owner).setPaymentHub(paymentHubAddress);
  await factoryManager.connect(owner).setOfferFactory(offerFactoryAddress);
  await factoryManager.connect(owner).setRecoveryHub(recoveryHubAddress);
  await factoryManager.connect(owner).setMultiSigCloneFactory(multiSigCloneFactoryAddress);
  await factoryManager.connect(owner).setPermit2Hub(permit2HubAddress);

  console.log("Setting manager in Factories...");
  await tokenFactory.connect(owner).setManager(factoryManagerAddress);
  await draggableFactory.connect(owner).setManager(factoryManagerAddress);
  await alowlistDraggableFactory.connect(owner).setManager(factoryManagerAddress);
  await brokerbotFactory.connect(owner).setManager(factoryManagerAddress);
  await factory.connect(owner).setManager(factoryManagerAddress);

  console.log("Setting up aktionariat factory...");
  await factory.connect(owner).setBrokerbotFactory(brokerbotFactoryAddress);
  await factory.connect(owner).setTokenFactory(tokenFactoryAddress);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });