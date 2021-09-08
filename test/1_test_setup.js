/* global artifacts, contract, web3, assert */

// Shared Migration Config
const config = require("../migrations/migration_config");

// Libraries
const BN = require("bn.js");

// Used contracts
const ERC20 = artifacts.require("ERC20");
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const Brokerbot = artifacts.require("Brokerbot");

contract("Migration", (accounts) => {
  it("should have some ETH in first 5 accounts", async () => {
    for (let i = 0; i < 5; i++) {
      const balance = new BN(await web3.eth.getBalance(accounts[i]));
      assert(!balance.isZero());
    }
  });

  it("should have some BaseCurrency in first 5 accounts", async () => {
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    for (let i = 0; i < 5; i++) {
      const balance = await erc20.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  });

  it("should have some Shares in first 5 accounts", async () => {
    const shares = await Shares.deployed();
    for (let i = 0; i < 5; i++) {
      const balance = await shares.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  });

  it("should have some DraggableShares in first 5 accounts", async () => {
    const draggableShares = await DraggableShares.deployed();
    for (let i = 0; i < 5; i++) {
      const balance = await draggableShares.balanceOf(accounts[i]);
      assert(!balance.isZero());
    }
  });

  it("should have DraggableShares and BaseCurrency deposited into the Brokerbot", async () => {
    const draggableShares = await DraggableShares.deployed();
    const erc20 = await ERC20.at(config.baseCurrencyAddress);
    const brokerbot = await Brokerbot.deployed();
    const tokenBalance = await draggableShares.balanceOf(brokerbot.address);
    const baseBalance = await erc20.balanceOf(brokerbot.address);
    assert(!tokenBalance.isZero() && !baseBalance.isZero());
  });
});
