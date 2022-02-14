const {network, ethers} = require("hardhat");
const { expect } = require("chai");
const Chance = require("chance");
const { mintBaseCurrency, mintERC20, setBalance } = require("./helper/index");

// Shared Migration Config
const config = {
  symbol: "BOND",
  name: "Test Bond",
  terms: "test.ch/terms",
  totalBonds: 40000000,
  bondPrice: "500000000000000000",
  timeToMarturity: "432000000", //5000days around 14y
  mintDecrement: 10,
  baseCurrencyAddress: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08",
  baseCurrencyMinterAddress: "0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9",
  xchfBalanceSlot: 2,
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  quorumBps: 7500,
  votePeriodSeconds: 5184000,
  uniswapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
}

describe("Bond Contract", () => {
  let bond;
  let bondBot;
  let baseCurrency;
  let paymentHub;
  let paymentHubContract
  
  let deployer;
  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let adr5;
  let accounts;

  before(async () => {
    [deployer,owner,adr1,adr2,adr3,adr4,adr5] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address,adr5.address];
    //console.log(accounts);

    chance = new Chance();

    await deployments.fixture(["Bond", "PaymentHub", "BondbotDAI"]);
    bond = await ethers.getContract("Bond");
    bondBot = await ethers.getContract("BondbotDAI");
    paymentHub = await ethers.getContract("PaymentHub");

    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);

    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await setBalance(baseCurrency, config.xchfBalanceSlot, accounts);

    //Mint bonds to first 5 accounts
    for( let i = 0; i < 5; i++) {
      await bond.connect(owner).mint(accounts[i], 100000);
    }

    //Deposit Bonds and BaseCurrency into BondBot
    //await bond.transfer(bondBot.address, 50000000);
    await baseCurrency.connect(owner).transfer(bondBot.address, ethers.utils.parseEther("100000"));


    // Allow payment hub to spend baseCurrency from accounts[0] and bond from Brokerbot
    await bond.connect(owner).approve(paymentHub.address, config.infiniteAllowance);
    await baseCurrency.connect(owner).approve(paymentHub.address, config.infiniteAllowance);
    await bondBot.connect(owner).approve(bond.address, paymentHub.address, config.infiniteAllowance);
    await bondBot.connect(owner).approve(baseCurrency.address, paymentHub.address, config.infiniteAllowance);

     // Set Payment Hub for bondBot
     await bondBot.connect(owner).setPaymentHub(paymentHub.address);


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
    });
    it("Should set the right owner", async () =>{
      expect(await bond.owner()).to.equal(owner.address);
    });

    it("Should get right claim deleter", async () => {
      expect(await bond.getClaimDeleter()).to.equal(owner.address);
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

    it("should increase price correctly", async () => {
      const oneYear = 365 * 24 * 60 * 60;
      const driftIncrement = ethers.BigNumber.from(config.bondPrice).div(ethers.BigNumber.from(5000));
      await bondBot.connect(owner).setDrift(86400, driftIncrement);
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

    it("Should be able to transfer bond tokens", async () => {
      const randomAmount = chance.natural({ min: 500, max: 50000 });
      // get balance of adr1 before transfer
      const balanceBefore = await bond.balanceOf(adr1.address);
      //transfer random ammount
      await bond.connect(owner).transfer(adr1.address, randomAmount);
      // check balance of adr1 after transfer
      const balanceAfter = await bond.balanceOf(adr1.address);

      expect(balanceBefore.add(randomAmount)).to.equal(balanceAfter)
    });

    it("Should be able to burn bond tokens", async () => {
      const randomAmount = chance.natural({ min: 500, max: 50000 });
      // get balance of owner before transfer
      const balanceBefore = await bond.balanceOf(owner.address);
      //burn random ammount
      await bond.connect(owner).burn(randomAmount);
      // check balance of adr1 after transfer
      const balanceAfter = await bond.balanceOf(owner.address);

      expect(balanceBefore.sub(randomAmount)).to.equal(balanceAfter)
    });

    it("Should set custom claim collateral", async () => {
      const collateralAddress = config.baseCurrencyAddress;
      const collateralRate = 10;
      // test that only owenr can set
      await expect(bond.connect(adr1).setCustomClaimCollateral(collateralAddress, collateralRate))
        .to.be.revertedWith("not owner");
      // test with owner
      await bond.connect(owner).setCustomClaimCollateral(collateralAddress, collateralRate);
      expect(await bond.customCollateralAddress()).to.equal(collateralAddress);
      expect(await bond.customCollateralRate()).to.equal(collateralRate);
    });
  });

  describe("Events", () => {
    it("Should emit event for announcment", async () => {
      const message = "Test";
      await expect(bond.connect(owner).announcement(message))
        .to.emit(bond, 'Announcement')
        .withArgs(message);
    });

    it("Should change terms and emit event", async () => {
      const newTerms = "www.test.com/newterms";
      await expect(bond.connect(owner).setTerms(newTerms))
        .to.emit(bond, 'TermsChanged')
        .withArgs(newTerms);

      // check if terms set correct
      expect(await bond.terms()).to.equal(newTerms);
    });
  });
});

