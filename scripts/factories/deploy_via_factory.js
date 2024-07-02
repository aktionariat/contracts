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

  console.log("Setting up Factory Manager...");
  factoryManager.connect(owner).setPaymentHub(paymentHub);
  factoryManager.connect(owner).setOfferFactory(offerFactory);
  factoryManager.connect(owner).setRecoveryHub(recoveryHub);
  factoryManager.connect(owner).setMultiSigCloneFactory(multiSigCloneFactory);
  factoryManager.connect(owner).setPermit2Hub(permit2Hub);

  console.log("Setting manager in Factories...");
  tokenFactory.connect(owner).setManager(factoryManager);
  draggableFactory.connect(owner).setManager(factoryManager);
  alowlistDraggableFactory.connect(owner).setManager(factoryManager);
  brokerbotFactory.connect(owner).setManager(factoryManager);
  factory.connect(owner).setManager(factoryManager);

  console.log("Setting up aktionariat factory...");
  factory.connect(owner).setBrokerbotFactory(brokerbotFactory);
  factory.connect(owner).setTokenFactory(tokenFactory);


}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });