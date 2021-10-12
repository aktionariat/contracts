const {network, ethers, } = require("hardhat");
const { expect } = require("chai");

// Shared  Config
const config = require("../migrations/migration_config");

describe("Draggable", () => {
  let draggable
  let shares
  let recoveryHub;

  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let accounts;

  before(async () => {
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];

    recoveryHub = await ethers.getContractFactory("RecoveryHub")
      .then(recoveryHubFactory => recoveryHubFactory.deploy())
      .then(recoveryHub => recoveryHub.deployed());

    shares = await ethers.getContractFactory("Shares")
     .then(sharesFactory => sharesFactory.deploy(config.symbol, config.name, config.terms, config.totalShares, owner.address, recoveryHub.address))
     .then(shares => shares.deployed());

    draggable = await ethers.getContractFactory("DraggableShares")
      .then(draggableFactory => draggableFactory.deploy(config.terms, shares.address, config.quorumBps, config.votePeriodSeconds, recoveryHub.address))
      .then(draggable => draggable.deployed());

  });

  it("Should deploy contracts", async () => {
    expect(shares.address).to.exist;
    expect(draggable.address).to.exist;
  });
});