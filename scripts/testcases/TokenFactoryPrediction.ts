import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AllowlistDraggableFactory, FactoryManager, TokenFactory } from "../../typechain-types";
import { switchForkedNetwork } from "../helpers/switchNetwork";

describe("Test Factory Address Prediction", function () {
  let owner: HardhatEthersSigner;

  let tokenFactory: TokenFactory;
  let allowlistDraggableFactory: AllowlistDraggableFactory;
  let factoryManager: FactoryManager;
  let salt = "0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE000000000000000000000dae";
  
  before(async function() {
    await switchForkedNetwork("mainnet");

    [owner] = await ethers.getSigners();
    
    allowlistDraggableFactory = await hre.ethers.deployContract("AllowlistDraggableFactory", [await owner.getAddress()]);
    tokenFactory = await hre.ethers.deployContract("TokenFactory", [await owner.getAddress(), await allowlistDraggableFactory.getAddress()]);
    factoryManager = await ethers.getContractAt("FactoryManager", "0x555E7852d4ab6F8C557F9Bc6d17ADdb8c7911d78");

    await tokenFactory.setManager(factoryManager.getAddress());
    await allowlistDraggableFactory.setManager(factoryManager.getAddress());
  });

  it("Should predict token address correctly - Without draggable", async function () {
    let tokenConfig = {
      name: "TEST Base Token",
      symbol: "TEST",
      terms: "https://test.aktionariat.com/terms",
      draggable: false,
      numberOfShares: 1000000,
      quorumDrag: 5100,
      quorumMigration: 5100,
      votePeriod: 68400
    }

    // Predict
    let predictedAllowlistSharesAddress = await tokenFactory.predictTokenAddress(tokenConfig, await owner.getAddress(), salt);

    // Deploy
    await tokenFactory.createToken(tokenConfig, await owner.getAddress(), salt);

    // Check if the predicted address matches the deployed address
    let allowlistShares = await ethers.getContractAt("AllowlistShares", predictedAllowlistSharesAddress);

    expect(await allowlistShares.symbol()).to.equal(tokenConfig.symbol);
    expect(await allowlistShares.name()).to.equal(tokenConfig.name);
  });

  it("Should predict token address correctly - With draggable", async function () {
    let tokenConfig = {
      name: "TEST DRAGGABLE Token",
      symbol: "TEST",
      terms: "https://test.aktionariat.com/terms",
      draggable: true,
      numberOfShares: 1000000,
      quorumDrag: 5100,
      quorumMigration: 5100,
      votePeriod: 68400
    }

    // Predict
    let predictedAllowlistDraggableSharesAddress = await tokenFactory.predictTokenAddress(tokenConfig, await owner.getAddress(), salt);

    // Deploy
    await tokenFactory.createToken(tokenConfig, await owner.getAddress(), salt);

    // Check if the predicted address matches the deployed address
    let allowlistDraggableShares = await ethers.getContractAt("AllowlistDraggableShares", predictedAllowlistDraggableSharesAddress);

    expect(await allowlistDraggableShares.symbol()).to.equal(tokenConfig.symbol + "S");
    expect(await allowlistDraggableShares.name()).to.equal(tokenConfig.name + " SHA");
  });
});