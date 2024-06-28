const { ethers } = require("hardhat");
const { expect } = require("chai");
const { Interface } = require("ethers");
const { setup, randomBigInt, giveApproval, setBalance, allowanceType } = require("./helper/index");

// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
const { quorumMigration } = require("../scripts/deploy_config_mainnet.js");
const config = require(`..${getConfigPath()}`);

describe("Factories", () => {
  let registry;
  let permit2Hub;
  let offerFactory;
  let brokerbot;
  let zchfContract;
  let brokerbotAddress;
  let factory;
  let tokenFactory;
  let brokerbotFactory;
  let factoryManager;
  let multiSigCloneFactory

  let deployer
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let chainid;


  before(async() => {
    chainid = (await ethers.provider.getNetwork()).chainId;
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5,sig6] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
  });
  beforeEach(async() => {
    // deploy contracts
  await deployments.fixture([
    "RecoveryHub",
    "OfferFactory",
    "PaymentHub",
    "BrokerbotRegistry",
    "Permit2Hub",
    "AktionariatFactory",
    "TokenFactory",
    "BrokerbotFactory",
    "FactoryManager",
    "MultiSigCloneFactory"
  ]);

    // get references
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    factory = await ethers.getContract("AktionariatFactory");
    tokenFactory = await ethers.getContract("TokenFactory");
    brokerbotFactory = await ethers.getContract("BrokerbotFactory");
    factoryManager = await ethers.getContract("FactoryManager");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");
    permit2Hub = await ethers.getContract("Permit2Hub");
    registry = await ethers.getContract("BrokerbotRegistry");

    // set up factories
    factoryManager.connect(owner).setPaymentHub(paymentHub);
    factoryManager.connect(owner).setOfferFactory(offerFactory);
    factoryManager.connect(owner).setRecoveryHub(recoveryHub);
    factoryManager.connect(owner).setMultiSigCloneFactory(multiSigCloneFactory);
    factoryManager.connect(owner).setPermit2Hub(multiSigCloneFactory);
    factoryManager.connect(owner).setBrokerbotRegistry(registry);

    tokenFactory.connect(owner).setManager(factoryManager);
    brokerbotFactory.connect(owner).setManager(factoryManager);
    factory.connect(owner).setManager(factoryManager);
    factory.connect(owner).setBrokerbotFactory(brokerbotFactory);
    factory.connect(owner).setTokenFactory(tokenFactory);    
  });

  describe("Factories setup", () => {
    it("Should set up all correct", async() => {
      expect(await factory.manager()).to.be.equal(await factoryManager.getAddress());
    })
  })

  describe("Multisig deployment", () => {
    it("Should deploy a multisig", async() => {
      const salt = ethers.encodeBytes32String('1');
      const newMultisig = await factory.createMultisig(sig1.address, salt);

      const eventABI = ["event ContractCreated(address indexed contractAddress, string indexed typeName)"]
      const iface = new Interface(eventABI);
      const receipt = await newMultisig.wait();
      receipt.logs.forEach((log) => {
        const parsedLog = iface.parseLog(log);
        if (parsedLog) console.log(`deployed multisig: ${parsedLog.args.contractAddress}`);
      });
    })
  });

  describe("Token deployment", () => {
    it("Should deploy token", async() => {
      let tokenAddress;
      const tokenOwner = sig2;
      const tokenConfig = {
        name: config.name,
        symbol: config.symbol,
        terms: config.terms,
        allowlist: false,
        draggable: false,
        numberOfShares: config.totalShares,
        quorumDrag: config.quorumBps,
        quorumMigration: config.quorumMigration,
        votePeriod: config.votePeriodSeconds
      }

      const tokenEventABI = ["event BaseTokenCreated(address indexed token, address indexed owner, bool allowlist)"]
      const ifaceToken = new Interface(tokenEventABI);

      const createToken = await tokenFactory.createToken(tokenConfig, tokenOwner);
      const receipt = await createToken.wait();
      receipt.logs.forEach((log) => {
        const parsedLog = ifaceToken.parseLog(log);
        if (parsedLog) {
          console.log(`deployed token: ${parsedLog.args.token}`);
          tokenAddress = parsedLog.args.token;
          expect(parsedLog.args.owner).to.be.equal(tokenOwner.address);
          expect(parsedLog.args.allowlist).to.be.equal(tokenConfig.allowlist);
        }
      });

      const shares = await ethers.getContractAt("Shares", tokenAddress);
      expect(await shares.name()).to.be.equal(tokenConfig.name);
      expect(await shares.symbol()).to.be.equal(tokenConfig.symbol);
      expect(await shares.terms()).to.be.equal(tokenConfig.terms);
      expect(await shares.totalShares()).to.be.equal(tokenConfig.numberOfShares);

      
    })
  });
});