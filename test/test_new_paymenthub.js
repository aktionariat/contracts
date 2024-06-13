const {network, ethers, deployments, getNamedAccounts} = require("hardhat");
const { setBalances, getImpersonatedSigner, randomBigInt } = require("./helper/index");
const Chance = require("chance");
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { encodeRouteToPath } = require("@uniswap/v3-sdk");
const { expect } = require("chai");
const { setup } = require("./helper/index");

// Shared  Config
const { getConfigPath } = require('../scripts/utils.js');
const config = require(`..${getConfigPath()}`);

describe("New PaymentHub", () => {
  const ethersProvider = new ethers.BrowserProvider(network.provider);
  //const router = new AlphaRouter({ chainId: 1, provider: ethersProvider });
  const WETH = new Token(
    1,
    config.wethAddress,
    18,
    'WETH',
    'Wrapped Ether'
  );

  const DAI = new Token(
    1,
    config.daiAddress,
    18,
    'DAI',
    'DAI'
  );

  const XCHF = new Token(
    1,
    config.baseCurrencyAddress,
    18,
    'XCHF',
    'CryptoFranc'
  );

  const WBTC = new Token(
    1,
    config.wbtcAddress,
    8,
    "WBTC",
    "Wrapped Bitcoin"
  );


  let shares;
  let baseCurrency;
  let paymentHub;
  let brokerbot;
  let brokerbotDAI;
  let brokerbotZCHF;
  let daiContract;
  let wbtcContract;
  let zchfContract;

  let deployer;
  let owner;
  let sig1;
  let sig2;
  let sig3;
  let sig4;
  let sig5;
  let accounts;
  let signers;

  let chance;
  let baseCurrencyAmount
  let daiAmount
  let zchfAmount;
  let randomShareAmount
  let path;

  before(async () => {
    // get signers and accounts of them
    [deployer,owner,sig1,sig2,sig3,sig4,sig5] = await ethers.getSigners();
    signers = [owner,sig1,sig2,sig3,sig4,sig5];
    accounts = [owner.address,sig1.address,sig2.address,sig3.address,sig4.address,sig5.address];
    

    chance = new Chance();

    // deploy contracts
    await setup(true);

    // get references
    baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
    daiContract = await ethers.getContractAt("ERC20Named", config.daiAddress);
    wbtcContract = await ethers.getContractAt("ERC20Named", config.wbtcAddress)
    zchfContract = await ethers.getContractAt("ERC20Named", config.zchfAddress);

    paymentHub = await ethers.getContract("PaymentHub");
    shares = await ethers.getContract("Shares");
    draggableShares = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
    brokerbotDAI = await ethers.getContract("BrokerbotDAI");
    brokerbotZCHF = await ethers.getContract("BrokerbotZCHF");
  });

  describe("Deployment", () => {
    describe("PaymentHub", () => {
      it("Should deploy contract", async () => {
        expect(await paymentHub.getAddress()).to.exist;
      });
      it("Should give back newest version", async () => {
        expect(await paymentHub.VERSION()).to.equal(9);
      });
      it("Should deploy with correct forwarder", async () => {
        const { trustedForwarder } = await getNamedAccounts();
        expect(await paymentHub.trustedForwarder()).to.equal(trustedForwarder);
      });
      it("Should set new forwarder", async () => {
        const { trustedForwarder } = await getNamedAccounts();
        const forwarderSigner = await getImpersonatedSigner(trustedForwarder);
        await expect(paymentHub.connect(sig1).changeForwarder(trustedForwarder))
          .to.be.revertedWithCustomError(paymentHub, "PaymentHub_InvalidSender")
          .withArgs(sig1.address);
        await expect(paymentHub.connect(forwarderSigner).changeForwarder(sig1.address))
          .to.emit(paymentHub, "ForwarderChanged")
          .withArgs(trustedForwarder, sig1.address);
        expect(await paymentHub.trustedForwarder()).to.equal(sig1.address);
        // reset forwarder to orignal
        await paymentHub.connect(sig1).changeForwarder(trustedForwarder);
      })
    });

    describe("BrokerBot", () => {
      it("Should deploy contract", async () => {
        expect(await brokerbot.getAddress()).to.exist;
      });
    });
  });

  describe("Recover token / eth", () => {
    let relayer;
    beforeEach(async() => {
      // impersonate trusted forwarder
      const { trustedForwarder } = await getNamedAccounts();
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [trustedForwarder],
      });
      relayer = await ethers.getSigner(trustedForwarder);
    })
    afterEach(async() => {
      const { trustedForwarder } = await getNamedAccounts();
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [trustedForwarder],
      });
    });
    it("Should be able to recover token sent to paymenthub", async () => {
      const wrongSent = randomBigInt(1, 500);
      const balBefore = await baseCurrency.balanceOf(sig1.address);
      await baseCurrency.connect(sig1).transfer(await paymentHub.getAddress(), wrongSent);
      const balInbetween = await baseCurrency.balanceOf(sig1.address);
      expect(balBefore - wrongSent).to.equal(balInbetween);
      await expect(paymentHub.connect(relayer).recover(await baseCurrency.getAddress(), sig1.address, wrongSent+1n))
        .to.be.reverted;
      await paymentHub.connect(relayer).recover(await baseCurrency.getAddress(), sig1.address, wrongSent);
      const balInAfter = await baseCurrency.balanceOf(sig1.address);
      expect(balBefore).to.equal(balInAfter);
    });
    it("Should revert when recover token is called by non forwarder", async () => {
      const wrongSent = chance.natural({ min: 1, max: 500 });
      await expect(paymentHub.connect(sig1).recover(await baseCurrency.getAddress(), sig1.address, wrongSent))
        .to.be.revertedWithCustomError(paymentHub, "PaymentHub_InvalidSender")
        .withArgs(sig1.address);
    });
    it("Should revert when withdraw eth is called by non forwarder", async () => {
      valueEth = ethers.parseEther("1");
      await expect(paymentHub.connect(sig1).withdrawEther(sig1.address, valueEth))
        .to.be.revertedWithCustomError(paymentHub, "PaymentHub_InvalidSender")
        .withArgs(sig1.address);
    });
    it("Shoul be possible to recover eth sent to paymenthub", async () => {
      const paymentHubsBlanceBefore = await ethers.provider.getBalance(await paymentHub.getAddress());
      //send eth
      valueEth = ethers.parseEther("1");
      const tx_send = {
        from: sig1.address,
        to: await paymentHub.getAddress(),
        value: valueEth,
        nonce: await ethers.provider.getTransactionCount(
          sig1.address,
            "latest"
        )};
      await sig1.sendTransaction(tx_send);
      const paymentHubBalanceAfter = await ethers.provider.getBalance(await paymentHub.getAddress());
      expect(paymentHubsBlanceBefore + valueEth).to.equal(paymentHubBalanceAfter);
      const balBefore = await ethers.provider.getBalance(sig1.address);
      await paymentHub.connect(relayer).withdrawEther(sig1.address, valueEth);
      const balAfter = await ethers.provider.getBalance(sig1.address);
      expect(balBefore + valueEth).to.equal(balAfter);
    });
  });

  // TODO: rework test for matic and WETH
  describe("Trading with ETH", () => {
    //  usdc - weth
    const types = ["address","uint24","address"];
    const values = [config.baseCurrencyAddress, 500, config.wethAddress];
    const pathBaseWeth = ethers.solidityPacked(types,values);
    beforeEach(async () => {
      randomShareAmount = randomBigInt(1, 500);
      baseCurrencyAmount = await brokerbot.getBuyPrice(randomShareAmount);
    });
    it("Should get price in ETH", async () => {
      // no oracle on Polyogn
      /*const pricematic = await paymentHub.getLatestPriceETHUSD();
      // console.log(await priceeth.toString());
      const priceInMatic = await paymentHub.getPriceInEtherFromOracle(ethers.parseEther("1000"), await brokerbot.base());*/

      const priceInEther = await paymentHub.getPriceInEther.staticCall(baseCurrencyAmount, await brokerbot.getAddress(), pathBaseWeth);
      expect(priceInEther).to.be.above(0n);
    });

    it("Should revert if buy with ETH and send wrong path w/o XCHF", async () => {
      // dai -0.05- eth
      const types = ["address","uint24","address"];
      const values = [config.daiAddress, 500, config.wethAddress];
      const pathEthDai = ethers.solidityPacked(types,values);
      const buyer = sig1;
      const priceInETH = await paymentHub.getPriceInEther.staticCall(baseCurrencyAmount, await brokerbot.getAddress(), pathBaseWeth);
      await expect(paymentHub.connect(buyer).payFromEtherAndNotify(await brokerbot.getAddress(), baseCurrencyAmount, "0x01", pathEthDai, {value: priceInETH}))
        .to.be.revertedWithCustomError(paymentHub, "PaymentHub_SwapError")
        .withArgs(baseCurrencyAmount, 0);
    });


    it("Should buy shares with ETH and trade it to XCHF", async () => {
      const buyer = sig1;
      const priceInETH = await paymentHub.getPriceInEther.staticCall(baseCurrencyAmount, await brokerbot.getAddress(), pathBaseWeth);

      // send a little bit more for slippage 
      const priceInETHWithSlippage = priceInETH * 101n / 100n;
      //log balances
      const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const buyerSharesBefore = await draggableShares.balanceOf(buyer.address);
      const buyerEthBefore = await ethers.provider.getBalance(buyer.address);

      const txInfo = await paymentHub.connect(buyer).payFromEtherAndNotify(await brokerbot.getAddress(), baseCurrencyAmount, "0x01", pathBaseWeth, {value: priceInETHWithSlippage});
      const { gasPrice, cumulativeGasUsed} = await txInfo.wait();
      const gasCost = gasPrice * cumulativeGasUsed;
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const buyerSharesAfter = await draggableShares.balanceOf(buyer.address);
      const buyerEthAfter = await ethers.provider.getBalance(buyer.address);

      // brokerbot should have after the payment with eth the base currency in the balance
      expect(brokerbotBalanceBefore + baseCurrencyAmount).to.equal(brokerbotBalanceAfter);
      expect(buyerSharesAfter - buyerSharesBefore).to.equal(randomShareAmount);
      expect(buyerEthBefore - buyerEthAfter).to.equal(priceInETH + gasCost);
    });

    it("Should set setting for keeping ETH", async () => {
      const settingKeepETh = config.KEEP_ETHER;
      const settingsBefore = await brokerbot.settings();

      // new setting with combination of old setting plus keep ETH
      const newSetting = settingsBefore ^ settingKeepETh;

      await brokerbot.connect(owner).setSettings(newSetting);
      const settingsAfter = await brokerbot.settings();

      expect(settingsAfter).to.not.equal(settingsBefore);
      expect(settingsAfter).to.equal(newSetting);
    });

    it("Should revert if buy with ETH and send to less ETH", async () => {
      const priceInETH = await paymentHub.getPriceInEther.staticCall(baseCurrencyAmount, await brokerbot.getAddress(), pathBaseWeth);
      const lowerPriceInETH = (priceInETH * 90n) / 100n;
      await expect(paymentHub.connect(sig1).payFromEtherAndNotify(await brokerbot.getAddress(), baseCurrencyAmount, "0x01", pathBaseWeth, {value: lowerPriceInETH})).to.be.reverted;
    });

    // not used on polygon (same as on OP)
    it.skip("Should buy shares with ETH and keep ETH", async () => {
      const priceInETH = await paymentHub.getPriceInEther.staticCall(baseCurrencyAmount, await brokerbot.getAddress(), pathBaseWeth);
      // console.log(await ethers.utils.formatEther(priceInETH));
      // console.log(await priceInETH.toString());

      // overpay in eth to test payback
      const pricePlus = priceInETH * 110n / 100n;

      //simulate buy inbetween to show adding slippage is accounted for
      await expect(paymentHub.connect(sig2).payFromEtherAndNotify(await brokerbot.getAddress(), baseCurrencyAmount, "0x01", pathBaseWeth, {value: priceInETH}))
        .to.emit(brokerbot, "Received").withArgs(sig2.address, priceInETH, baseCurrencyAmount);

      const brokerbotETHBefore = await ethers.provider.getBalance(await brokerbot.getAddress());
      const buyerETHBefore = await ethers.provider.getBalance(sig1.address);
      const tx = await paymentHub.connect(sig1).payFromEtherAndNotify(await brokerbot.getAddress(), baseCurrencyAmount, "0x01", pathBaseWeth, {value: pricePlus});
      const { gasPrice, cumulativeGasUsed} = await tx.wait();
      // get how much eth was paid for tx
      const gasPaid = gasPrice * cumulativeGasUsed;
      const brokerbotETHAfter = await ethers.provider.getBalance(await brokerbot.getAddress());
      const buyerETHAfter = await ethers.provider.getBalance(sig1.address);
      // console.log(await ethers.utils.formatEther(brokerbotETHAfter));
      // brokerbot balance only increase priceInETH not pricePlus -> correct eth is send to brokerbot
      expect(brokerbotETHBefore + priceInETH).to.equal(brokerbotETHAfter);
      // buyer balance decrease in gas paid for tx + priceInETH -> overpaid eth is send back
      expect(buyerETHBefore -  priceInETH - gasPaid).to.equal(buyerETHAfter);
    });

    // broker bot isn't receiving ether/matic on polygon / OP
    it.skip("Should be able to withdraw ETH from brokerbot as owner", async () => {
      const brokerbotETHBefore = await ethers.provider.getBalance(await brokerbot.getAddress());
      const ownerETHBefore = await ethers.provider.getBalance(owner.address);
      // draggableShares don't have a payable receive/fallback function and should fail
      await expect(brokerbot.connect(owner)["withdrawEther(address,uint256)"](await draggableShares.getAddress(), brokerbotETHBefore))
        .to.be.revertedWithCustomError(brokerbot, "Brokerbot_WithdrawFailed")
        .withArgs(await draggableShares.getAddress(), brokerbotETHBefore);
      await expect(brokerbot["withdrawEther(uint256)"](brokerbotETHBefore))
        .to.be.revertedWithCustomError(brokerbot, "Brokerbot_NotAuthorized")
        .withArgs(deployer.address);
      await expect(brokerbot.connect(owner)["withdrawEther(uint256)"](brokerbotETHBefore + 1n))
        .to.be.revertedWithCustomError(brokerbot, "Brokerbot_WithdrawFailed")
        .withArgs(owner.address, brokerbotETHBefore + 1n);
      await expect(brokerbot.connect(owner)["withdrawEther(uint256)"](brokerbotETHBefore))
        .to.emit(brokerbot, 'Withdrawn').withArgs(owner.address, brokerbotETHBefore);
      const brokerbotETHAfter = await ethers.provider.getBalance(await brokerbot.getAddress());
      const ownerETHAfter = await ethers.provider.getBalance(owner.address);
      expect(brokerbotETHAfter).to.be.equal(0n);
      expect(ownerETHAfter).to.be.above(ownerETHBefore);
    });
  });

  describe("Trading with DAI base", () => {
    // dai -0.05- eth
    const types = ["address","uint24","address"];
    const values = [config.daiAddress, 3000, config.wethAddress];
    const pathEthDAI = ethers.solidityPacked(types,values);
    beforeEach(async () => {
      randomShareAmount = randomBigInt(1, 5000);
      daiAmount = await brokerbotDAI.getBuyPrice(randomShareAmount);
    });

    // no oracle on Polygon - skip
    it.skip("Should get right ETH price ", async () => {
      const priceeth = await paymentHub.getLatestPriceETHUSD();
      // console.log(await priceeth.toString());
      // console.log(await daiAmount.toString());
      const priceInETH = await paymentHub.getPriceInEtherFromOracle(daiAmount, await brokerbotDAI.getAddress());
      expect(ethers.formatEther(priceInETH)).to.equal(
        ethers.formatEther(daiAmount * 10n ** 8n / priceeth));
    });

    it("Should buy shares with ETH and trade it to DAI", async () => {
      const priceInETH = await paymentHub.getPriceInEther.staticCall(daiAmount, await brokerbotDAI.getAddress(), pathEthDAI);

      // send a little bit more for slippage
      const priceInETHWithSlippage = priceInETH * 101n / 100n;

      const brokerbotBalanceBefore = await daiContract.balanceOf(await brokerbotDAI.getAddress());
      await paymentHub.connect(sig1).payFromEtherAndNotify(await brokerbotDAI.getAddress(), daiAmount, "0x01", pathEthDAI, {value: priceInETHWithSlippage});
      const brokerbotBalanceAfter = await daiContract.balanceOf(await brokerbotDAI.getAddress());

      // brokerbot should have after the payment with eth the dai in the balance
      expect(brokerbotBalanceBefore + daiAmount).to.equal(brokerbotBalanceAfter);
    });

    it("Should buy shares and pay with DAI", async () => {
      const buyer = sig1;
      // allowance for DAI
      await daiContract.connect(buyer).approve(await paymentHub.getAddress(), daiAmount);

      const brokerbotBalanceBefore = await daiContract.balanceOf(await brokerbotDAI.getAddress());
      const paymentHubAdr1 = await paymentHub.connect(buyer);
      await paymentHubAdr1["payAndNotify(address,uint256,bytes)"](await brokerbotDAI.getAddress(), daiAmount, "0x01");
      const brokerbotBalanceAfter = await daiContract.balanceOf(await brokerbotDAI.getAddress());

      // brokerbot should have after the payment the dai in the balance
      expect(brokerbotBalanceBefore + daiAmount).to.equal(brokerbotBalanceAfter);
    });
  });

  describe("Trading with ZCHF base", () => {
    // xchf -0.01- dchf -0.05- usdc -0.05- eth
    const types = ["address","uint24","address","uint24","address"];
    const values = [config.zchfAddress, 100, config.usdtAddress, 500, config.wethAddress];
    const pathEthZCHF = ethers.solidityPacked(types,values);
    beforeEach(async () => {
      randomShareAmount = randomBigInt(1, 50);
      zchfAmount = await brokerbotZCHF.getBuyPrice(randomShareAmount);
    });

    // TODO: change paymenthub getPriceInEtherFromOracle to use ZCHF
    it.skip("Should get right ETH price ", async () => {
      const priceeth = await paymentHub.getLatestPriceETHUSD();
      const priceZchfEth = await paymentHub.getPriceInERC20.staticCall(zchfAmount, pathEthZCHF);
      // console.log(await priceeth.toString());
      // console.log(await daiAmount.toString());
      const priceInETH = await paymentHub.getPriceInEtherFromOracle(zchfAmount, await brokerbotZCHF.getAddress(), pathEthZCHF);
      expect(priceInETH * 102n /100n ).to.gt(
        priceZchfEth);
    });

    it("Should buy shares with ETH and trade it to ZCHF", async () => {
      const priceInETH = await paymentHub.getPriceInEther.staticCall(zchfAmount, await brokerbotZCHF.getAddress(), pathEthZCHF);

      // send a little bit more for slippage
      const priceInETHWithSlippage = priceInETH * 101n / 100n;

      const brokerbotBalanceBefore = await zchfContract.balanceOf(await brokerbotZCHF.getAddress());
      await paymentHub.connect(sig1).payFromEtherAndNotify(await brokerbotZCHF.getAddress(), zchfAmount, "0x01", pathEthZCHF, {value: priceInETHWithSlippage});
      const brokerbotBalanceAfter = await zchfContract.balanceOf(await brokerbotZCHF.getAddress());

      // brokerbot should have after the payment with eth the dai in the balance
      expect(brokerbotBalanceBefore + zchfAmount).to.equal(brokerbotBalanceAfter);
    });

    // TODO: need to adadpt script to get zchf on accounts first
    it("Should buy shares and pay with ZCHF", async () => {
      const buyer = sig1;
      // allowance for zchf
      await zchfContract.connect(buyer).approve(await paymentHub.getAddress(), zchfAmount);

      const brokerbotBalanceBefore = await zchfContract.balanceOf(await brokerbotZCHF.getAddress());
      const paymentHubAdr1 = await paymentHub.connect(buyer);
      await paymentHubAdr1["payAndNotify(address,uint256,bytes)"](await brokerbotZCHF.getAddress(), zchfAmount, "0x01");
      const brokerbotBalanceAfter = await zchfContract.balanceOf(await brokerbotZCHF.getAddress());

      // brokerbot should have after the payment the dai in the balance
      expect(brokerbotBalanceBefore + zchfAmount).to.equal(brokerbotBalanceAfter);
    });
  });


  describe("Trading ERC20 with base", () => {
    before(async () => {
      randomShareAmount = randomBigInt(1, 500);
      baseCurrencyAmount = await brokerbot.getBuyPrice(randomShareAmount);
      const types = ["address","uint24","address","uint24","address"];
      const values = [config.baseCurrencyAddress, 500, config.wethAddress, 500, config.wbtcAddress];
      path = ethers.solidityPacked(types,values);
    });

    it("Should get price in WBTC via WETH", async () => {
      const price = await paymentHub.getPriceInERC20.staticCall(baseCurrencyAmount, path);
      //console.log(await ethers.formatEther(price));
      expect(price).to.be.above(0);
    });

    it("Should buy shares with WBTC and trade it to base currency", async () => {
      const base = await brokerbot.base();
      const buyer = sig1;
      //approve WBTC in the paymenthub
      await paymentHub.approveERC20(config.wbtcAddress);

      // get approximate price
      const priceInWBTC = await paymentHub.getPriceInERC20.staticCall(baseCurrencyAmount, path);

      // little bit more for slippage
      const priceInWBTCWithSlippage = priceInWBTC * 101n / 100n;

      // approve wbtc for the user
      await wbtcContract.connect(buyer).approve(await paymentHub.getAddress(), priceInWBTCWithSlippage);

      //trade and log balance change
      const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const sharesBefore = await draggableShares.balanceOf(sig1.address);
      //console.log("before: %s", await ethers.formatEther(brokerbotBalanceBefore));
      const { amountIn, amountOut } = await paymentHub.connect(buyer).payFromERC20AndNotify.staticCall(await brokerbot.getAddress(), baseCurrencyAmount, await wbtcContract.getAddress(), priceInWBTCWithSlippage, path, "0x01");
      await paymentHub.connect(buyer).payFromERC20AndNotify(await brokerbot.getAddress(), baseCurrencyAmount, await wbtcContract.getAddress(), priceInWBTCWithSlippage, path, "0x01");
      const sharesAfter = await draggableShares.balanceOf(buyer.address);
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
      //console.log("after: %s", await ethers.formatEther(brokerbotBalanceAfter));

      // brokerbot should have after the payment with eth the base currency in the balance
      expect(brokerbotBalanceBefore + baseCurrencyAmount).to.equal(brokerbotBalanceAfter);

      // user should get the amount of shares
      expect(sharesBefore + randomShareAmount).to.equal(sharesAfter);
      expect(amountIn).to.equal(priceInWBTC);
      expect(amountOut).to.equal(randomShareAmount);

      // allowance for payment - uniswaprouter is infinit and always above 0
      expect(await wbtcContract.allowance(await paymentHub.getAddress(), "0xE592427A0AEce92De3Edee1F18E0157C05861564")).to.be.above(0);
    });
  });

  describe("Trading with base currency", async () => {
    before(async () => {
      randomShareAmount = randomBigInt(1, 5000);
      baseCurrencyAmount = await brokerbot.getBuyPrice(randomShareAmount);
    });

    it("Should buy shares with base currency", async () => {
      const buyer = sig1;
      // allowance for base currency
      await baseCurrency.connect(buyer).approve(await paymentHub.getAddress(), baseCurrencyAmount);

      const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const paymentHubAdr1 = await paymentHub.connect(buyer);

      // revert if want to buy with more base currency than is owned
      const exceedingAmount = ethers.parseEther("1000000000");
      await expect(paymentHubAdr1["payAndNotify(address,uint256,bytes)"](await brokerbot.getAddress(), exceedingAmount, "0x01"))
        .to.be.reverted;

      await paymentHubAdr1["payAndNotify(address,uint256,bytes)"](await brokerbot.getAddress(), baseCurrencyAmount, "0x01");
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());

      // brokerbot should have after the payment the base currency in the balance
      expect(brokerbotBalanceBefore + baseCurrencyAmount).to.equal(brokerbotBalanceAfter);
    })

    it("Should be able to buy shares via multiPayAndNotify", async () => {
      const buyer = sig1;
      // allowance for base currency
      await baseCurrency.connect(buyer).approve(await paymentHub.getAddress(), baseCurrencyAmount * 2n);

      const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const paymentHubAdr1 = await paymentHub.connect(buyer);
      const brokerbots = [await brokerbot.getAddress(), await brokerbot.getAddress()];
      const amounts = [baseCurrencyAmount, baseCurrencyAmount];
      await paymentHubAdr1.multiPayAndNotify(config.baseCurrencyAddress, brokerbots, amounts, "0x01");
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());

      // brokerbot should have after the payment the base currency in the balance
      expect(brokerbotBalanceBefore + baseCurrencyAmount * 2n).to.equal(brokerbotBalanceAfter);
    })
    
    it("Should repay base currency if too much was paid", async () => {
      const buyer = sig1;
      // allowance for base currency
      await baseCurrency.connect(buyer).approve(await paymentHub.getAddress(), config.infiniteAllowance);

      // overpay amount
      const overpayDif = ethers.parseUnits("0.5", await baseCurrency.decimals());
      const overpayAmount = baseCurrencyAmount + overpayDif;

      const brokerbotBalanceBefore = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const userBalanceBefore = await baseCurrency.balanceOf(buyer.address);
      const paymentHubAdr1 = await paymentHub.connect(buyer);
      await paymentHubAdr1["payAndNotify(address,uint256,bytes)"](await brokerbot.getAddress(), overpayAmount, "0x01");
      const brokerbotBalanceAfter = await baseCurrency.balanceOf(await brokerbot.getAddress());
      const userBalanceAfter = await baseCurrency.balanceOf(buyer.address);

      // brokerbot should have after the payment the base currency in the balance
      expect(brokerbotBalanceBefore + baseCurrencyAmount).to.equal(brokerbotBalanceAfter);
      // user should have deducted the base currency amount not the overpaid ammount
      expect(userBalanceBefore - baseCurrencyAmount).to.equal(userBalanceAfter);
    })
  });

  describe("Trading ERC20 with DAI base", () => {
    before(async () => {
      randomShareAmount = randomBigInt(1, 5000);
      daiAmount = await brokerbotDAI.getBuyPrice(randomShareAmount);
      // get best route via auto router
      /*const daiCurrencyAmount = CurrencyAmount.fromRawAmount(DAI, daiAmount);
      const route = await router.route(
        daiCurrencyAmount,
        XCHF,
        TradeType.EXACT_OUTPUT,
        {
          recipient: sig1.address,
          slippageTolerance: new Percent(5, 100),
          deadline: 100
        }
      );

      path = encodeRouteToPath(route.route[0].route, true);*/
      const types = ["address","uint24","address","uint24","address"];
      const values = [config.daiAddress, 3000, config.wethAddress, 3000, config.baseCurrencyAddress];
      path = ethers.solidityPacked(types,values);
    });
    it("Should get price in base currency to DAI auto route", async () => {
      const price = await paymentHub.getPriceInERC20.staticCall(daiAmount, path);
      // console.log(ethers.formatEther(daiAmount));
      // console.log(ethers.formatEther(price));
      expect(price).to.be.above(0);
    });

    it("Should buy shares with base currency and trade it to DAI", async () => {
      const buyer = sig1;
      //approve base currency in the paymenthub
      await paymentHub.approveERC20(config.baseCurrencyAddress);

      // get approximate price
      const priceInBaseCurrency = await paymentHub.getPriceInERC20.staticCall(daiAmount, path);

      // little bit more for slippage
      const priceInBaseCurrencyWithSlippage = priceInBaseCurrency * 101n / 100n;

      // approve base currency for the user
      await baseCurrency.connect(buyer).approve(await paymentHub.getAddress(), priceInBaseCurrencyWithSlippage);

      //trade and log balance change
      const brokerbotBalanceBefore = await daiContract.balanceOf(await brokerbotDAI.getAddress());
      const sharesBefore = await shares.balanceOf(buyer.address);
      //console.log("before: %s", await ethers.formatEther(brokerbotBalanceBefore));
      const {amountIn, amountOut} = await paymentHub.connect(sig1).payFromERC20AndNotify.staticCall(await brokerbotDAI.getAddress(), daiAmount, await baseCurrency.getAddress(), priceInBaseCurrencyWithSlippage, path, "0x01");
      await paymentHub.connect(sig1).payFromERC20AndNotify(await brokerbotDAI.getAddress(), daiAmount, await baseCurrency.getAddress(), priceInBaseCurrencyWithSlippage, path, "0x01");
      const sharesAfter = await shares.balanceOf(buyer.address);
      const brokerbotBalanceAfter = await daiContract.balanceOf(await brokerbotDAI.getAddress());
      //console.log("after: %s", await ethers.formatEther(brokerbotBalanceAfter));

      // brokerbot should have after the payment with eth the base currency in the balance
      expect(brokerbotBalanceBefore + daiAmount).to.equal(brokerbotBalanceAfter);

      // user should get the amount of shares
      expect(sharesBefore + randomShareAmount).to.equal(sharesAfter);
      expect(amountIn).to.equal(priceInBaseCurrency);
      expect(amountOut).to.equal(randomShareAmount);

      // allowance for payment - uniswaprouter is infinit and always above 0
      expect(await baseCurrency.allowance(await paymentHub.getAddress(), "0xE592427A0AEce92De3Edee1F18E0157C05861564")).to.be.above(0);
    });

  });
});
