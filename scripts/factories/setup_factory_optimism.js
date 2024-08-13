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

  const paymentHubAddress = "0xd70Cd32bF9BA7F0355CF3fE55929FCe461e2b9e0";
  const offerFactoryAddress = "0x6c4028d7Fd82f29cD97A47E7342F02Ca529c5531";
  const permit2HubAddress = "0x510845c50819328E5C74991CC7d7d9103595fc75";
  const recoveryHubAddress = "0xf00B91839fF7A6AC6DddAC7e73D2F222C19A9Ec3";
  const multiSigCloneFactoryAddress = "0xae52fdaadebfe4d943546d3f60640ba6959b8fcb";
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