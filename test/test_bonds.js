//const { ethers, hre } = require("hardhat");
const {network, ethers} = require("hardhat");
const { expect } = require("chai");

// Shared Migration Config
const config = {
  symbol: "TEST",
  name: "Test Bond",
  terms: "test.ch/terms",
  totalBonds: 40000000,
  bondPrice: "500000000000000000",
  timeToMarturity: "432000000", //5000days around 14y
  mintDecrement: 10,
  baseCurrencyAddress: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08",
  baseCurrencyMinterAddress: "0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9",
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  quorumBps: 7500,
  votePeriodSeconds: 5184000,
  uniswapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
}

describe("Bond Contract", () => {
  let BondBotFactory;
  let BondFactory;
  let PaymentHubFactory;
  let ForceSendFactory;
  let recoveryHub;

  let bond;
  let bondBot;
  let baseCurrency;
  let paymentHub;
  let paymentHubContract
  let forceSend;

  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let accounts;

  before(async () =>{
    BondBotFactory = await ethers.getContractFactory("BondBot");
    BondFactory = await ethers.getContractFactory("Bond");

    forceSend = await await ethers.getContractFactory("ForceSend")
    .then(factory => factory.deploy())
    .then(contract => contract.deployed());

    const priceFeedCHFUSD = "0x449d117117838fFA61263B61dA6301AA2a88B13A";  // ethereum mainnet
    const priceFeedETHUSD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ethereum mainnet
    paymentHub = await await ethers.getContractFactory("PaymentHub")
      .then(factory => factory.deploy(config.baseCurrencyAddress, priceFeedCHFUSD, priceFeedETHUSD))
      .then(contract => contract.deployed());

    recoveryHub = await ethers.getContractFactory("RecoveryHub")
    .then(factory => factory.deploy())
    .then(contract => contract.deployed());
    
  });
  
  beforeEach(async () => {
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];
    //console.log(accounts);

    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);
    bond = await BondFactory.deploy(config.symbol, config.name, config.terms, config.totalBonds, config.timeToMarturity, config.mintDecrement, owner.address, recoveryHub.address);
    bondBot = await BondBotFactory.deploy(bond.address, config.bondPrice, config.baseCurrencyAddress, owner.address);

    await bond.deployed();
    await bondBot.deployed();

    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [config.baseCurrencyMinterAddress],
    });
    const signer = await ethers.provider.getSigner(config.baseCurrencyMinterAddress);
    await forceSend.send(config.baseCurrencyMinterAddress, {value: ethers.BigNumber.from("1000000000000000000")});
    for (let i = 0; i < 5; i++) {
      await baseCurrency.connect(signer).mint(accounts[i], ethers.utils.parseEther("10000000"));
     //console.log("account %s chf %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
    }
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [config.baseCurrencyMinterAddress],
    });

    //Mint bonds to first 5 accounts
    await bond.setMinter(owner.address);
    for( let i = 0; i < 5; i++) {
      await bond.mint(accounts[i], 100000);
    }

    //Deposit Bonds and BaseCurrency into BondBot
    //await bond.transfer(bondBot.address, 50000000);
    await baseCurrency.transfer(bondBot.address, ethers.utils.parseEther("100000"));


    // Allow payment hub to spend baseCurrency from accounts[0] and bond from Brokerbot
    await bond.approve(paymentHub.address, config.infiniteAllowance, { from: owner.address });
    await baseCurrency.approve(paymentHub.address, config.infiniteAllowance, { from: owner.address });
    await bondBot.approve(bond.address, paymentHub.address, config.infiniteAllowance);
    await bondBot.approve(baseCurrency.address, paymentHub.address, config.infiniteAllowance);

     // Set Payment Hub for bondBot
     await bondBot.setPaymentHub(paymentHub.address);

     // Set Bond Bot as Minter
     await bond.setMinter(bondBot.address);


     //set paymenthub overloading
     const abi = [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "xchfamount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "ref",
            "type": "bytes"
          }
        ],
        "name": "payAndNotify",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "ref",
            "type": "bytes"
          }
        ],
        "name": "payAndNotify",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
     ];
     paymentHubContract = new ethers.Contract(paymentHub.address, abi, owner);


  });

  describe("Deployment", () => {
    it("should deploy", async () => {
      assert(bond.address !== "");
    });
  
    it("should get constructor params correctly", async () => {
      assert.equal(await bond.symbol(), config.symbol);
      assert.equal(await bond.name(), config.name);
      assert.equal(await bond.terms(), config.terms);
      assert.equal(await bond.maxSupply(), config.totalBonds);
    });
    it("Should set the right owner", async () =>{
      expect(await bond.owner()).to.equal(owner.address);
    });

    it("Should calculate correct max mintable supply", async () => {
      expect(await bond.maxMintable()).to.equal(config.totalBonds);
    });
  });

  describe("Setup", () => {
    it("should have some ETH in first 5 accounts", async () => {  
      for (let i = 0; i < 5; i++) {
        const balance = ethers.BigNumber.from(await ethers.provider.getBalance(accounts[i]));
        assert(!balance.isZero(), "Balance is 0");
      }
    });
  
    it("should have some BaseCurrency in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await baseCurrency.balanceOf(accounts[i]);
        assert(!balance.isZero(), "Balance is 0");
      }
    });

    it("should have some Bonds in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await bond.balanceOf(accounts[i]);
        assert(!balance.isZero(), "Balance is 0");
      }
    });

    it("should have BaseCurrency deposited into the Brokerbot", async () => {
      const baseBalance = await baseCurrency.balanceOf(bondBot.address);
      assert(!baseBalance.isZero());
    });
  });

  describe("Transctions", () => {
    it("should mint correct amount of token when buying bonds at start", async () => {
      const balanceBefore = await bond.balanceOf(adr1.address);
      await bond.connect(adr1).approve(paymentHub.address, config.infiniteAllowance);
      await baseCurrency.connect(adr1).approve(paymentHub.address, config.infiniteAllowance);
      const paymentHubAdr1 = await paymentHubContract.connect(adr1);
      await paymentHubAdr1["payAndNotify(address,uint256,bytes)"](bondBot.address, ethers.utils.parseEther("1000"), "0x");
      const balanceAfter = await bond.balanceOf(adr1.address);
      // with price of 0.5 (see config) buying with 1000 results in 2000 additional bonds
      expect(await bond.totalSupply()).to.equal(502000);
      expect(balanceAfter).to.equal(balanceBefore.add(2000));
    });

    it("should correctly decrease max mintable amount", async () => {
      const oneYear = 365 * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [oneYear]);
      await ethers.provider.send("evm_mine");
      const maxMintable = await bond.maxMintable();
      expect(await bond.maxMintable()).to.equal(config.totalBonds - (config.mintDecrement * 24 * 365));
    });

    it("should increase price correctly", async () => {
      const oneYear = 365 * 24 * 60 * 60;
      const driftIncrement = ethers.BigNumber.from(config.bondPrice).div(ethers.BigNumber.from(5000));
      await bondBot.setDrift(86400, driftIncrement);
      const blockNumStart = await ethers.provider.getBlockNumber();
      const blockStart= await ethers.provider.getBlock(blockNumStart);
      expect(await bondBot.getPriceAtTime(blockStart.timestamp)).to.equal(config.bondPrice);

      await ethers.provider.send("evm_increaseTime", [oneYear]);
      await ethers.provider.send("evm_mine");

      const blockNumAfter = await ethers.provider.getBlockNumber();
      const blockAfter = await ethers.provider.getBlock(blockNumAfter);
      const priceAfter = await bondBot.getPriceAtTime(blockAfter.timestamp);
      expect(priceAfter).to.equal(ethers.BigNumber.from(config.bondPrice).add(driftIncrement.mul(365)));
    });

    it("should burn on token on sell", async () => {
      expect(await bond.totalSupply()).to.equal(500000);
      await bond.connect(adr1).transferAndCall(bondBot.address, 1000, "0x");
      expect(await bond.totalSupply()).to.equal(499000);
    });
  });
});

