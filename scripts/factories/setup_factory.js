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

  [deployer,owner,sig1,sig2,sig3,sig4,sig5,sig6] = await ethers.getSigners();
  
  paymentHub = await ethers.getContract("PaymentHub");
  recoveryHub = await ethers.getContract("RecoveryHub");
  offerFactory = await ethers.getContract("OfferFactory");
  factory = await ethers.getContract("AktionariatFactory");
  tokenFactory = await ethers.getContract("TokenFactory");
  brokerbotFactory = await ethers.getContract("BrokerbotFactory");
  factoryManager = await ethers.getContract("FactoryManager");
  multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");
  permit2Hub = await ethers.getContract("Permit2Hub");
  draggableFactory = await ethers.getContract("DraggableTokenFactory");
  alowlistDraggableFactory = await ethers.getContract("AllowlistDraggableFactory");

  const factoryManagerAddress = await factoryManager.getAddress();
  const paymentHubAddress = await paymentHub.getAddress();
  const offerFactoryAddress = await offerFactory.getAddress();
  const recoveryHubAddress = await recoveryHub.getAddress();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  const brokerbotFactoryAddress = await brokerbotFactory.getAddress();
  const multiSigCloneFactoryAddress = await multiSigCloneFactory.getAddress();
  const permit2HubAddress = await permit2Hub.getAddress();

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