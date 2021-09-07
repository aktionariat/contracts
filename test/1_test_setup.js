// Shared Migration Config
const config = require("../migrations/migration_config");

// Libraries
const BN = require('bn.js');

// Used contracts
const ERC20 = artifacts.require("ERC20");
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");

contract('Migration', accounts => {
  it('should have some ETH in first 5 accounts', async () => {
    for (var i =  0 ; i < 5 ; i++) {
      let balance = new BN(await web3.eth.getBalance(accounts[i]));
      assert(!balance.isZero());
    }
  })

  it('should have some BaseCurrency in first 5 accounts', async () => {
    let erc20 = await ERC20.at(config.baseCurrencyAddress);
    for (var i =  0 ; i < 5 ; i++) {
      let balance = await erc20.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  })

  it('should have some Shares in first 5 accounts', async () => {
    let shares = await Shares.deployed();
    for (var i =  0 ; i < 5 ; i++) {
      let balance = await shares.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  })

  it('should have some DraggableShares in first 5 accounts', async () => {
    let draggableShares = await DraggableShares.deployed();
    for (var i =  0 ; i < 5 ; i++) {
      let balance = await draggableShares.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  })

  it('should have DraggableShares and BaseCurrency deposited into the Brokerbot', async () => {
    let draggableShares = await DraggableShares.deployed();
    let erc20 = await ERC20.at(config.baseCurrencyAddress);
    let brokerbot = await Brokerbot.deployed();
    let tokenBalance = await draggableShares.balanceOf(brokerbot.address);
    let baseBalance = await erc20.balanceOf(brokerbot.address);
    assert(!tokenBalance.isZero() && !baseBalance.isZero());
  })

})