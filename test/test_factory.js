const { ethers } = require("hardhat");
const { expect } = require("chai");
const { Interface } = require("ethers");
const { setup, randomBigInt, giveApproval, setBalance, allowanceType } = require("./helper/index");

// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
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
  let draggableFactory;
  let alowlistDraggableFactory;
  let brokerbotFactory;
  let factoryManager;
  let multiSigCloneFactory
  let shares;

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
    "DraggableTokenFactory",
    "AllowlistDraggableFactory",
    "BrokerbotFactory",
    "FactoryManager",
    "MultiSigCloneFactory",
    "Shares"
  ]);

    // get references
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    paymentHub = await ethers.getContract("PaymentHub");
    recoveryHub = await ethers.getContract("RecoveryHub");
    offerFactory = await ethers.getContract("OfferFactory");
    factory = await ethers.getContract("AktionariatFactory");
    tokenFactory = await ethers.getContract("TokenFactory");
    draggableFactory = await ethers.getContract("DraggableTokenFactory");
    alowlistDraggableFactory = await ethers.getContract("AllowlistDraggableFactory");
    brokerbotFactory = await ethers.getContract("BrokerbotFactory");
    factoryManager = await ethers.getContract("FactoryManager");
    multiSigCloneFactory = await ethers.getContract("MultiSigCloneFactory");
    permit2Hub = await ethers.getContract("Permit2Hub");
    registry = await ethers.getContract("BrokerbotRegistry");
    shares = await ethers.getContract("Shares");

    // set up factories
    factoryManager.connect(owner).setPaymentHub(paymentHub);
    factoryManager.connect(owner).setOfferFactory(offerFactory);
    factoryManager.connect(owner).setRecoveryHub(recoveryHub);
    factoryManager.connect(owner).setMultiSigCloneFactory(multiSigCloneFactory);
    factoryManager.connect(owner).setPermit2Hub(multiSigCloneFactory);

    tokenFactory.connect(owner).setManager(factoryManager);
    draggableFactory.connect(owner).setManager(factoryManager);
    alowlistDraggableFactory.connect(owner).setManager(factoryManager);
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
    it("Should deploy share token", async() => {
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

    it("Should deploy draggable token", async() => {
      let tokenAddress;
      let draggableTokenAddress;
      const tokenOwner = sig2;
      const tokenConfig = {
        name: config.name,
        symbol: config.symbol,
        terms: config.terms,
        allowlist: false,
        draggable: true,
        numberOfShares: config.totalShares,
        quorumDrag: config.quorumBps,
        quorumMigration: config.quorumMigration,
        votePeriod: config.votePeriodSeconds
      }

      const draggableEventABI = ["event DraggableTokenCreated(address indexed draggable, address indexed baseToken, address indexed owner, bool allowlist)"]
      const ifaceDraggable = new Interface(draggableEventABI);

      const createToken = await tokenFactory.createToken(tokenConfig, tokenOwner);
      const receipt = await createToken.wait();
      receipt.logs.forEach((log) => {
        const parsedLog = ifaceDraggable.parseLog(log);
        if (parsedLog) {
          console.log(`deployed draggable token: ${parsedLog.args.draggable}`);
          tokenAddress = parsedLog.args.baseToken;
          draggableTokenAddress = parsedLog.args.draggable;
          expect(parsedLog.args.owner).to.be.equal(tokenOwner.address);
          expect(parsedLog.args.allowlist).to.be.equal(tokenConfig.allowlist);
        }
      });
      const shares = await ethers.getContractAt("Shares", tokenAddress);
      expect(await shares.name()).to.be.equal(tokenConfig.name);
      expect(await shares.symbol()).to.be.equal(tokenConfig.symbol);
      expect(await shares.terms()).to.be.equal(tokenConfig.terms);
      expect(await shares.totalShares()).to.be.equal(tokenConfig.numberOfShares);
      const draggableToken = await ethers.getContractAt("DraggableShares", draggableTokenAddress);
      expect(await draggableToken.wrapped()).to.be.equal(tokenAddress);
    })

    it("Should deploy allowlist draggable token", async() => {
      let tokenAddress;
      let allowlistDraggableTokenAddress;
      const tokenOwner = sig2;
      const tokenConfig = {
        name: config.name,
        symbol: config.symbol,
        terms: config.terms,
        allowlist: true,
        draggable: true,
        numberOfShares: config.totalShares,
        quorumDrag: config.quorumBps,
        quorumMigration: config.quorumMigration,
        votePeriod: config.votePeriodSeconds
      }

      const draggableEventABI = ["event DraggableTokenCreated(address indexed draggable, address indexed baseToken, address indexed owner, bool allowlist)"]
      const ifaceDraggable = new Interface(draggableEventABI);

      const createToken = await tokenFactory.createToken(tokenConfig, tokenOwner);
      const receipt = await createToken.wait();
      receipt.logs.forEach((log) => {
        const parsedLog = ifaceDraggable.parseLog(log);
        if (parsedLog) {
          console.log(`deployed draggable token: ${parsedLog.args.draggable}`);
          tokenAddress = parsedLog.args.baseToken;
          allowlistDraggableTokenAddress = parsedLog.args.draggable;
          expect(parsedLog.args.owner).to.be.equal(tokenOwner.address);
          expect(parsedLog.args.allowlist).to.be.equal(tokenConfig.allowlist);
        }
      });
      const shares = await ethers.getContractAt("Shares", tokenAddress);
      expect(await shares.name()).to.be.equal(tokenConfig.name);
      expect(await shares.symbol()).to.be.equal(tokenConfig.symbol);
      expect(await shares.terms()).to.be.equal(tokenConfig.terms);
      expect(await shares.totalShares()).to.be.equal(tokenConfig.numberOfShares);
      const allowlistDraggableToken = await ethers.getContractAt("AllowlistDraggableShares", allowlistDraggableTokenAddress);
      expect(await allowlistDraggableToken.wrapped()).to.be.equal(tokenAddress);

    })
  });

  describe("Brokerbot deployment", () => {
    it("Should deploy brokerbot", async() => {
      let brokerbotAddress;
      const brokerbotOwner = sig3;
      const brokerbotConfig = {
        price: config.sharePrice,
        increment: config.increment,
        baseToken: config.baseCurrencyAddress
      }

      const brokerbotEventABI = ["event BrokerbotCreated(address indexed brokerbot, address indexed token, address indexed owner)"];
      const ifaceBrokerbot = new Interface(brokerbotEventABI);

      const createBrokerbot = await brokerbotFactory.createBrokerbot(brokerbotConfig, await shares.getAddress(), brokerbotOwner.address);
      const receipt = await createBrokerbot.wait();
      receipt.logs.forEach((log) => {
        const parsedLog = ifaceBrokerbot.parseLog(log);
        if (parsedLog) {
          console.log(`deployed brokerbot: ${parsedLog.args.brokerbot}`);
          brokerbotAddress = parsedLog.args.brokerbot;
          expect(parsedLog.args.owner).to.be.equal(brokerbotOwner.address);
        }
      });
      const newBrokerbot = await ethers.getContractAt("Brokerbot", brokerbotAddress);

      expect(await newBrokerbot.getPrice()).to.be.equal(brokerbotConfig.price);
      expect(await newBrokerbot.increment()).to.be.equal(brokerbotConfig.increment);
      expect(await newBrokerbot.base()).to.be.equal(brokerbotConfig.baseToken);
    })
  });

  describe("Company deployment", () => {
    it("Should deploy company", async() => {
      let newSharesAddress;
      let newBrokerbotAddress;
      let newMultisigAddress;
      const multisigSigner = sig1;
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
      };
      const brokerbotConfig = {
        price: config.sharePrice,
        increment: config.increment,
        baseToken: config.baseCurrencyAddress
      };
      const companyEventABI = ["event CompanyCreated(address indexed multisig, address indexed token, address indexed brokerbot)"];
      const ifaceCompany = new Interface(companyEventABI);

      const newCompany = await factory.createCompany(tokenConfig, brokerbotConfig, multisigSigner);
      const receipt = await newCompany.wait();
      receipt.logs.forEach((log) => {
        const parsedLog = ifaceCompany.parseLog(log);
        if (parsedLog) {
          console.log(`deployed company owner: ${parsedLog.args.multisig}`);
          console.log(`deployed company token: ${parsedLog.args.token}`);
          console.log(`deployed company brokerbot: ${parsedLog.args.brokerbot}`);
          newSharesAddress = parsedLog.args.token;
          newBrokerbotAddress = parsedLog.args.brokerbot;
          newMultisigAddress = parsedLog.args.multisig;
        }
      });
      const newShares = await ethers.getContractAt("Shares", newSharesAddress);
      const newBrokerbot = await ethers.getContractAt("Brokerbot", newBrokerbotAddress);
      const newMultisig = await ethers.getContractAt("MultiSigWalletMaster", newMultisigAddress);

      expect(await newShares.name()).to.be.equal(tokenConfig.name);
      expect(await newShares.symbol()).to.be.equal(tokenConfig.symbol);
      expect(await newBrokerbot.getPrice()).to.be.equal(brokerbotConfig.price);
      expect(await newBrokerbot.increment()).to.be.equal(brokerbotConfig.increment);
      expect(await newBrokerbot.base()).to.be.equal(brokerbotConfig.baseToken);
      expect(await newMultisig.signers(multisigSigner.address)).to.be.equal(1n);
    })
  });
});