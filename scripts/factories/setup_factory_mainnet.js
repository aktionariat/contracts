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

  const paymentHubAddress = "0x4fA0C488F321A1D089f7E5f951fe8C43F2064709";
  const offerFactoryAddress = "0x9eA6427f76b27F939942941fFbA43667F4e2a45c";
  const permit2HubAddress = "0xd3DE54d9e424BF27b8259E69B205127722c771Cb";
  const recoveryHubAddress = "0x5e200B3C6e9ce8280dbB14A0E5486895456136EF";
  const multiSigCloneFactoryAddress = "0xC894ef112CC26741397053248F9f677398Eb56e2";
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